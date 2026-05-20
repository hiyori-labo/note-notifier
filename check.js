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
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: item.title,
              url: item.link,
              author: { name: `${user} が新しい記事を公開しました` },
              description: item.contentSnippet?.slice(0, 200),
              timestamp: item.pubDate,
              color: 0x41C9B4,
            }],
          }),
        });
      }
      if (feed.items[0]) state[user] = feed.items[0].pubDate;
    } catch (e) {
      console.error(`[${user}]`, e.message);
    }
  }
  fs.writeFileSync('state.json', JSON.stringify(state, null, 2));
})();