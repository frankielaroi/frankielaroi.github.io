// script.js
function toggleDrawer() {
  const drawer = document.querySelector('.drawer');
  if (drawer.classList.contains('drawer-open')) {
    drawer.classList.remove('drawer-open');
  } else {
    drawer.classList.add('drawer-open');
  }
}
