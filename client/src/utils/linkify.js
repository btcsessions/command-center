export function linkifyText(text, container) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  let lastIdx = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      container.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    const a = document.createElement('a');
    a.href = match[1];
    a.textContent = match[1];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    container.appendChild(a);
    lastIdx = urlRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}
