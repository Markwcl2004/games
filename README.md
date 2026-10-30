# 小游戏合集

放给朋友玩的网页小游戏，托管在 GitHub Pages：https://markwcl2004.github.io/

每个游戏一个子目录，互不依赖，各自的说明、测试和工具都在自己的目录里。根目录的 `index.html` 是游戏列表，加新游戏时在里面加一项。

| 游戏 | 目录 | 地址 |
|------|------|------|
| 坦克大战 | `tank-battle/` | https://markwcl2004.github.io/tank-battle/ |

所有游戏同在 `markwcl2004.github.io` 这一个域名下，共用同一份 localStorage，所以每个游戏的存储键要带自己的前缀（坦克大战用 `tb.`）。

本地预览整个站：在仓库根目录运行 `python3 -m http.server 8642`，打开 http://127.0.0.1:8642/ 。
