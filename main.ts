// Dip-bounce mean reversion v2 for cbBTC on 1-minute bars (agent-fun/bars-replay/v1).
//
// The idea: on this market the 1-minute noise is tiny (a few bps) while the real
// moves are slow grinds of 80-200 bps over 30-120 minutes, so the bot only trades
// when a real dip has happened, and it banks the bounce at a wider target:
//
//   - Entry, flat only, once at least 122 closes are known and at least 120 bars
//     have passed since the last sell: the latest close is at least 80 bps below
//     the highest close of the last 120 bars. It buys with all its cash, the
//     moment the dip is there -- no bounce confirmation, because waiting for one
//     cost a bar or two at a worse price on every swing of the dev window.
//   - Exit, the whole position: its value at the latest close is at least 115 bps
//     over its cost (take the bounce), or at least 80 bps under it (the dip kept
//     dipping: cut it).
//   - Cooldown: after any sell the bot waits 120 bars before the next entry,
//     counted from the bar on which the sell order was sent. On the dev window
//     the falls that follow a sell keep falling for an hour or more, and buying
//     back into them was the one losing trade; the wait skips those re-entries
//     and only takes the next fresh dip.
//
// Local grade on the dev window: net PnL +$29.737757 USDC, 5 trades, all
// winners, max drawdown 0.61% (grade-local, process driver, 2026-11-11).
//
// Every order caps its slippage at 300 bps past the close it was decided on.
// All decisions are exact integer (bigint) arithmetic on the closes the hello
// and each batch hand over, so the same bars give the same orders, run after run.
// No network, no wall clock, no files outside the repository.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** How far back the dip is measured from. */
const HIGH_BARS = 120;
/** The dip, in bps below the rolling high, that counts as a real fall. */
const DIP_BPS = 80n;
/** Take profit, in bps over the position's cost. */
const TARGET_BPS = 115n;
/** Stop loss, in bps under the position's cost. */
const STOP_BPS = 80n;
/** Bars to wait after a sell before the next entry. */
const COOLDOWN_BARS = 120;
/** Slippage cap on every order, in bps past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 300;
const BPS = 10000n;

/** Every CBBTC close so far, oldest first. */
const closes: bigint[] = [];
/** Index (in closes) of the bar on which the last sell order was sent, if any. */
let lastSellBar: number | null = null;

function maxOf(xs: readonly bigint[]): bigint {
  let m = xs[0];
  for (const x of xs) if (x > m) m = x;
  return m;
}

/** Whether a held position exits on this close: the bounce taken, or the dip kept dipping. */
function shouldExit(state: BarsState, held: { qty: bigint; cost: bigint }): boolean {
  const value = state.value(SYMBOL, held.qty);
  const takeProfit = value >= (held.cost * (BPS + TARGET_BPS)) / BPS;
  const stopLoss = value <= (held.cost * (BPS - STOP_BPS)) / BPS;
  return takeProfit || stopLoss;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): (BuyInput | SellInput)[] {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    closes.push(close);
    const barIndex = closes.length - 1;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (shouldExit(state, held)) {
        lastSellBar = barIndex;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    if (closes.length < HIGH_BARS + 2) return [];
    if (lastSellBar !== null && barIndex - lastSellBar < COOLDOWN_BARS) return [];
    const high = maxOf(closes.slice(-HIGH_BARS));
    const dipped = close <= (high * (BPS - DIP_BPS)) / BPS;
    if (!dipped) return [];
    if (state.cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
