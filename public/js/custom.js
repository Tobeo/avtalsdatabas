$(function() {
    $('.hcs-toggle').on('click', function(e) {
      e.preventDefault();
      $('#hcs-arrow').toggleClass('fa-chevron-down', 1000);
      $('#hcs-arrow').toggleClass('fa-chevron-up', 1000);
    });
  });