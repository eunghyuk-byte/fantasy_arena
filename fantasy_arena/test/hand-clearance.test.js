const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../css/game.css'),'utf8');
const render=fs.readFileSync(path.join(__dirname,'../js/render.js'),'utf8');
const start=css.indexOf('#game.active .col-main > .my-hand#myHand,');
const rule=css.slice(start,css.indexOf('}',start)+1);
test('default hand has an additional stage-relative downward clearance without reflow',()=>{
 assert.match(rule,/transform:\s*translateY\(calc\(8px\s*\+\s*5cqh\)\)/);
 assert.match(rule,/margin-bottom:\s*0\s*!important/);assert.match(rule,/padding-top:\s*6px\s*!important/);assert.match(rule,/overflow:\s*hidden\s*!important/);
 assert.match(render,/HAND_ROW_FRAC = 0\.28/);
});
test('hand source remains hidden during drag while hover/touch detail handlers stay present',()=>{
 assert.match(css,/#game\.active \.my-hand \.card\.dragging\s*\{[^}]*opacity:\s*0\s*!important/);
 const game=fs.readFileSync(path.join(__dirname,'../js/game.js'),'utf8');assert.match(game,/function showPeek\(/);assert.match(game,/bindTouchPeekHold\(el, card/);
});
