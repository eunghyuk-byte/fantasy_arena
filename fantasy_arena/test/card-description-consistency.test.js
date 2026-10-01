const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame,vm} = require('../test-support/harness');
test('all current card effects reach detail and hover data without stale copies', () => {
  const g=loadGame();
  const cards=vm.runInContext('CARDS.filter(c=>!c.token)',g);
  assert.equal(cards.length,300);
  for(const c of cards){
    const info=g.cardInfoParts(c);
    assert.equal(info.effectText,String(c.text||'').trim(),c.id);
    if(c.text)assert.ok(info.skillsHtml.includes(g.escHtml(c.text).replace(/\n/g,'<br>')),c.id);
    if(c.text&&(c.type==='spell'||c.type==='item'))assert.ok(g.collectAbilityTips(c).some(t=>t.title==='카드 효과'&&t.desc===c.text),c.id);
  }
});
test('changed flavor descriptions do not describe removed effects', () => {
  const g=loadGame();
  for(const [id,removed] of Object.entries({di7:'같은 체구의 말',ds4:'공방체',ei7:'적의 주문',ai7:'방패의 두께',fi7:'전열을 한꺼번에',fi5:'모든 면이 같게',fi1:'갑옷이 무른 숯',fi6:'적을 쓰러뜨릴수록'}))assert.ok(!g.loreOf(id).includes(removed),id);
  assert.match(g.loreOf('di7'),/여포/);
  assert.match(g.loreOf('ai7'),/셋/);
});
test('petrification ability help states its existing defense cap',()=>{
  const g=loadGame();const text=vm.runInContext('ATK_SKILL_HELP[8][1]',g);
  assert.match(text,/최대 5/);assert.match(text,/5 이상.*유지/);
});
