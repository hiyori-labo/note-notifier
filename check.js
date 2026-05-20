const Parser = require('rss-parser');
const fs = require('fs');

(async () => {
  const parser = new Parser();
  const creators = JSON.parse(fs.readFileSync('creators.json', 'utf-8'));
  const state = fs.existsSync('state.json')
    ? JSON.parse(fs.readFileSync('state.json', 'utf-8')) : {};

  for (const user of creators) {
    try {
      const feed = await parser.parseURL(`https://note.com/${user}/rss`);
      const last = state[user];
      // 初回は通知せずstateだけ作る（過去記事の大量通知防止）
      const newItems = last
        ? feed.items.filter(i => new Date(i.pubDate) > new Date(last))
        : [];

      for (const item of newItems.reverse()) {
        // Discord の timestamp は ISO8601 必須。RSS の pubDate は RFC2822 形式なので変換する。
        const ts = new Date(item.pubDate);
        const res = await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: item.title,
              url: item.link,
              author: { name: `${user} が新しい記事を公開しました` },
              description: item.contentSnippet?.slice(0, 200),
              timestamp: isNaN(ts) ? undefined : ts.toISOString(),
              color: 0x41C9B4,
            }],
          }),
        });
        // Discord が弾いても fetch は例外を投げないので明示的に確認する。
        // 失敗時は throw → catch でログ＆ stateを更新しない → 次回再送される。
        if (!res.ok) {
          throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
      }
      if (feed.items[0]) state[user] = feed.items[0].pubDate;
    } catch (e) {
      console.error(`[${user}]`, e.message);
    }
  }
  fs.writeFileSync('state.json', JSON.stringify(state, null, 2));
})();