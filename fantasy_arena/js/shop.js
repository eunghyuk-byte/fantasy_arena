(() => {
  const shop=document.getElementById('shop'), dialog=document.getElementById('shopInfo');
  if (!shop || !dialog) return;
  const title=document.getElementById('shopInfoTitle'), message=document.getElementById('shopInfoText');
  function show(heading,text) { title.textContent=heading; message.textContent=text; dialog.showModal(); }
  shop.querySelectorAll('.shop-buy').forEach(button=>button.addEventListener('click',()=>{
    const product=button.closest('.shop-product');
    const name=product.querySelector('h2').textContent, cards=product.querySelector('.shop-card-count').textContent, price=product.querySelector('.shop-price').textContent;
    show(name+' 구매 안내',`${name} · ${cards} · 표시 가격 ${price}. 현재 결제·팩 지급 기능이 미연동되어 구매가 불가합니다. 결제되거나 보유 팩이 변경되지 않습니다.`);
  }));
  document.getElementById('btnPackOpen').addEventListener('click',()=>{
    show('팩 열기 준비 중','보유 팩 원장이 미연동되어 실제 보유 수량을 확인하거나 팩을 열 수 없습니다. 팩이나 카드가 차감·지급되지 않습니다.');
  });
  // No checkout request, synthetic inventory, account mutation or reward generation.
})();
