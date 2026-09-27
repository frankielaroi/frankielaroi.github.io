/* Contact form: client-side validation + submission to the Google Apps Script endpoint. */
(function () {
  'use strict';

  var ENDPOINT =
    'https://script.google.com/macros/s/AKfycbxmQFWzT__DfkVW9WjUS5eeGEJ8PNNoulZg5BBdXncxyXbTlWMdx3AQ0l7UZiumRcrc9g/exec';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var status = document.getElementById('formStatus');
  var submit = form.querySelector('button[type="submit"]');

  var rules = [
    { id: 'name', message: 'Please tell me your name.', test: function (v) { return v.length > 0; } },
    { id: 'email', message: 'Please enter a valid email address.', test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); } },
    { id: 'subject', message: 'Please add a subject.', test: function (v) { return v.length > 0; } },
    { id: 'message', message: 'Please write a message.', test: function (v) { return v.length > 0; } }
  ];

  function setError(id, message) {
    var input = document.getElementById(id);
    var slot = form.querySelector('[data-error-for="' + id + '"]');
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (slot) slot.textContent = message || '';
  }

  function setStatus(message, tone) {
    if (!status) return;
    status.textContent = message || '';
    if (tone) status.setAttribute('data-tone', tone);
    else status.removeAttribute('data-tone');
  }

  rules.forEach(function (rule) {
    var input = document.getElementById(rule.id);
    if (!input) return;
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && rule.test(input.value.trim())) {
        setError(rule.id, '');
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstInvalid = null;
    rules.forEach(function (rule) {
      var input = document.getElementById(rule.id);
      if (!input) return;
      var ok = rule.test(input.value.trim());
      setError(rule.id, ok ? '' : rule.message);
      if (!ok && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      setStatus('Please fix the highlighted fields.', 'bad');
      firstInvalid.focus();
      return;
    }

    setStatus('');
    submit.disabled = true;
    submit.textContent = 'Sending…';

    fetch(ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.result === 'success') {
          form.reset();
          submit.textContent = 'Message sent';
          setStatus('Thanks — I\'ll get back to you shortly.', 'ok');
          setTimeout(function () {
            submit.disabled = false;
            submit.textContent = 'Send message';
          }, 4000);
        } else {
          throw new Error('Endpoint reported failure');
        }
      })
      .catch(function (err) {
        console.error('Contact form submission failed:', err);
        submit.disabled = false;
        submit.textContent = 'Send message';
        setStatus('Something went wrong. Please email frankiekweku@gmail.com instead.', 'bad');
      });
  });
})();
