import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const target = 'docs/art_audit';
const cssFiles = ['src/style.css', 'src/hand-readability.css', 'src/shop-balance.css', 'src/intent-queue.css'];
const colorOccurrences = [];
const motion = [];
const keyframes = [];
const fonts = [];
const tokens = [];
const colorFunctions = [];
const colorKeywords = [];
const normalizeHex = value => {
  const n = value.slice(1).toLowerCase();
  return '#' + (n.length <= 4 ? [...n].map(x => x + x).join('') : n);
};
const where = (node, file) => ({file, line: node.source.start.line, selector: node.parent.selector ?? `@${node.parent.name} ${node.parent.params}`, context: [...function* () {let p=node.parent; while(p){if(p.type==='atrule')yield `@${p.name} ${p.params}`;p=p.parent;}}()].reverse()});
for (const file of cssFiles) {
  const source=fs.readFileSync(file,'utf8');
  const tree=postcss.parse(source,{from:file});
  tree.walkAtRules('keyframes', k => keyframes.push({file,line:k.source.start.line,name:k.params,frames:k.nodes.map(f=>({offset:f.selector,declarations:f.nodes.map(d=>({property:d.prop,value:d.value}))}))}));
  tree.walkDecls(d=>{
    const base={...where(d,file),property:d.prop,value:d.value};
    for(const match of d.value.matchAll(/#[0-9a-fA-F]{3,8}\b/g))colorOccurrences.push({...base,raw:match[0],normalized:normalizeHex(match[0]),category:'css'});
    if(d.prop.startsWith('animation')||d.prop.startsWith('transition')||d.prop==='scroll-behavior')motion.push(base);
    if(d.prop==='font'||d.prop==='font-family'||d.prop==='--pixel')fonts.push(base);
    if(d.prop.startsWith('--'))tokens.push(base);
    for(const match of d.value.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([^;]+/g))colorFunctions.push({...base,raw:match[0]});
    for(const match of d.value.matchAll(/\b(?:transparent|currentcolor)\b/gi))colorKeywords.push({...base,raw:match[0].toLowerCase()});
  });
}
const files=['src/art.ts','src/guide.ts','src/main.ts','index.html'];
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b/g))colorOccurrences.push({file,line:source.slice(0,match.index).split('\n').length,raw:match[0],normalized:normalizeHex(match[0]),category:file.endsWith('.ts')?'inline-svg':'html'});
}
const hexPalette=[...new Set(colorOccurrences.map(r=>r.normalized))].sort().map(normalized=>({normalized,count:colorOccurrences.filter(r=>r.normalized===normalized).length,cssCount:colorOccurrences.filter(r=>r.normalized===normalized&&r.category==='css').length,occurrences:colorOccurrences.filter(r=>r.normalized===normalized)}));
const summary={cssFiles,hexTokens:colorOccurrences.length,hexUnique:hexPalette.length,cssHexTokens:colorOccurrences.filter(r=>r.category==='css').length,cssHexUnique:new Set(colorOccurrences.filter(r=>r.category==='css').map(r=>r.normalized)).size,byFile:[...cssFiles,...files].map(file=>({file,hexTokens:colorOccurrences.filter(r=>r.file===file).length,hexUnique:new Set(colorOccurrences.filter(r=>r.file===file).map(r=>r.normalized)).size})),keyframes:keyframes.length,animationDeclarations:motion.filter(r=>r.property==='animation').length,animationLonghands:motion.filter(r=>r.property.startsWith('animation-')).length,transitionDeclarations:motion.filter(r=>r.property==='transition').length,transitionLonghands:motion.filter(r=>r.property.startsWith('transition-')).length,fontDeclarations:fonts.length,colorFunctionOccurrences:colorFunctions.length,colorKeywordOccurrences:colorKeywords.length};
fs.writeFileSync(path.join(target,'presentation-data.json'),JSON.stringify({summary,hexPalette,motion,keyframes,fonts,tokens,colorFunctions,colorKeywords},null,2)+'\n');
let palette='# Exhaustive source color palette\n\nGenerated from the four imported CSS files plus art SVGs, guide SVGs, UI markup, and index fallback. Counts are literal occurrences, not rendered pixels. Shorthand hex is expanded and lowercased; alpha remains as an eighth byte. Variants with different alpha are distinct. CSS declarations overridden later are included because this is a source inventory. SVG uses of the shared `C` palette are indirect and do not add repeated literal counts. See [presentation-data.json](presentation-data.json) for each occurrence, selector, property, line, and context.\n\n';
palette+='| Normalized hex | All occurrences | CSS occurrences | Source locations |\n|---|---:|---:|---|\n';
for(const row of hexPalette){let locations=[...new Set(row.occurrences.map(o=>`${o.file}:${o.line}`))].join(', ');palette+=`| \`${row.normalized}\` | ${row.count} | ${row.cssCount} | ${locations} |\n`;}
palette+='\n## Other color notation\n\nNo rgb/rgba, hsl/hsla, hwb, lab/lch, oklab/oklch, or CSS color() values were found. `transparent` and `currentColor` (case-insensitive) occurrences are enumerated in the JSON. CSS has one `color-mix(in srgb, var(--card-face), #fff 5%)` occurrence. Many colors are referenced by CSS custom properties; see JSON `tokens`.\n';
fs.writeFileSync(path.join(target,'color-palette.md'),palette);
console.log(JSON.stringify(summary,null,2));
console.log(motion.filter(d=>!d.property.startsWith('animation')||d.property==='animation').map(d=>`${d.file}:${d.line} ${d.selector} ${d.property}: ${d.value}`).join('\n'));
