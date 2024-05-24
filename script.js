// script.js
function toggleDrawer() {
  const drawer = document.querySelector('.drawer');
  if (drawer.classList.contains('drawer-open')) {
    drawer.classList.remove('drawer-open');
  } else {
    drawer.classList.add('drawer-open');
  }
}
document.addEventListener('scroll', function() {
    const header = document.getElementById('header');
    const headerHeight = header.offsetHeight;
    
    if (window.scrollY > headerHeight) {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
});
  AOS.init();