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
window.addEventListener('load', function() {
    const preloader = document.getElementById('preloader');
});
window.addEventListener('load', function () {
    // Set a delay to simulate loading time (you can remove this in your actual implementation)
    setTimeout(function () {
        // Remove the preloader from the DOM
        var preloader = document.querySelector('.preloader');
      preloader.parentNode.removeChild(preloader);
      preloader.style.display = 'none'; // Hide the preloader once everything is loaded

    }, 3800); // Adjust the delay time as needed
});

  AOS.init();