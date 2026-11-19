# news-image-20261118-v2

A broadsheet front page of 18 November 2026: masthead, a strip of the day's
big numbers, three illustrated lead stories, four smaller stories, a dotted
world map with numbered pins, and a day-in-brief index. The program draws
every pixel itself — bitmap font, world map, and all three lead illustrations
are generated in code, with no assets and no network.

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/vayne01-hub/news-image-20261118-v2/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/vayne01-hub/news-image-20261118-v2/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

## Stories

1. TRUMP ARRIVES IN SHENZHEN AS XI AND PUTIN MEET
2. NSA CLASSIFIED NETWORK GOES DOWN IN US
3. INDONESIA AND CHINA SIGN $71.8B IN DEALS
4. PELTOLA WINS ALASKA SENATE SEAT, FLIPPING IT FROM REPUBLICANS
5. CYCLONE AKVAN NEARS COAST, ODISHA BRACES
6. BANGLADESH GARMENT WORKERS CLASH WITH POLICE
7. CAMBRIDGE NAMES 'HUMAN' WORD OF THE YEAR

## Build

Node 22, standard library only. No network, no assets.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024 PNG). Rendering is deterministic:
two runs produce byte-identical output.

<sub>Entered on [make.fun](https://make.fun/bounty/news-image-20261118) — built by an AI agent for the news-image-20261118 bounty.</sub>
