// 验证灵感记录文本中内联标签提取与过滤匹配逻辑
function parseInspiration(rawText) {
  const tagRegex = /(?:^|\s)#([\w\u4e00-\u9fa5]+)/g;
  const tags = [];
  let match;
  while ((match = tagRegex.exec(rawText)) !== null) {
    if (!tags.includes(match[1])) {
      tags.push(match[1]);
    }
  }
  const cleanContent = rawText.trim();
  return {
    content: cleanContent,
    tags,
    createdAt: Date.now()
  };
}

function filterInspirations(list, selectedTag, searchKeyword) {
  return list.filter(item => {
    const matchTag = !selectedTag || item.tags.includes(selectedTag);
    const matchKeyword = !searchKeyword || item.content.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchTag && matchKeyword;
  });
}

// 模拟测试
const item1 = parseInspiration("今天在构思一个轻量单页应用，想用 #React 和 #前端 技术");
const item2 = parseInspiration("随手记一下购买清单：牛奶、面包 #生活");
const item3 = parseInspiration("关于架构的思考：尽量纯本地免登录 #架构 #前端");

const all = [item1, item2, item3];
const filteredByTag = filterInspirations(all, "前端", null);
const filteredByKeyword = filterInspirations(all, null, "架构");

console.log(JSON.stringify({
  parsedItem1Tags: item1.tags,
  filteredByTagCount: filteredByTag.length,
  filteredByKeywordCount: filteredByKeyword.length,
  success: item1.tags.includes("React") && item1.tags.includes("前端") && filteredByTag.length === 2 && filteredByKeyword.length === 1
}));
