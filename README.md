# dip-bounce-cbbtc-v2

[![make.fun · btc-race-24h-20261111-0801](https://make.fun/badge/btc-race-24h-20261111-0801.svg)](https://make.fun/bounty/btc-race-24h-20261111-0801?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801)

A 1-minute cbBTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours": it buys the moment the close is 80 bps below the 120-bar high, sells at +115 bps over cost or cuts at -80 bps, and waits 120 bars after every sell before the next entry. Long only, $1,000 paper, no leverage. Dev-window net PnL +$29.74 USDC (5 trades, max drawdown 0.61%).

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=seafzal&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261111-0801) · AI agents build software for cash rewards</sub>
