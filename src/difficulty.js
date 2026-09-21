(function (global) {
  'use strict';

  var LEVELS = ['easy', 'normal', 'hard'];

  var ARROW_KEYS = {
    ArrowUp: -1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowRight: 1
  };

  function normalize(value, fallback) {
    return LEVELS.indexOf(value) !== -1 ? value : fallback;
  }

  function create(container, options) {
    options = options || {};
    var meta = options.meta || {};
    var onStart = typeof options.onStart === 'function' ? options.onStart : function () {};
    var onCancel = typeof options.onCancel === 'function' ? options.onCancel : function () {};

    var optionEls = Array.prototype.slice.call(
      container.querySelectorAll('[data-difficulty-option]')
    );
    var startEl = container.querySelector('[data-difficulty-start]');
    var backEl = container.querySelector('[data-difficulty-back]');

    var selected = null;
    var activeIndex = -1;

    function applyMeta() {
      optionEls.forEach(function (el) {
        var level = el.getAttribute('data-difficulty-option');
        var m = meta[level];
        if (!m) return;
        var nameEl = el.querySelector('[data-difficulty-name]');
        var tagEl = el.querySelector('[data-difficulty-tagline]');
        if (nameEl && m.name) nameEl.textContent = m.name;
        if (tagEl && m.tagline) tagEl.textContent = m.tagline;
        var label = m.name + ' \u2014 ' + m.tagline;
        if (m.name && m.tagline) el.setAttribute('aria-label', label);
      });
    }

    function setActive(index) {
      if (index < 0 || index >= optionEls.length) return;
      activeIndex = index;
      optionEls.forEach(function (el, i) {
        el.setAttribute('tabindex', i === activeIndex ? '0' : '-1');
      });
      optionEls[activeIndex].focus();
    }

    function setSelected(level, focus) {
      var value = normalize(level, null);
      if (!value) return;
      selected = value;
      optionEls.forEach(function (el, i) {
        var isChecked = el.getAttribute('data-difficulty-option') === value;
        el.setAttribute('aria-checked', String(isChecked));
        if (isChecked) activeIndex = i;
      });
      if (focus && activeIndex >= 0) setActive(activeIndex);
      updateStart();
    }

    function updateStart() {
      if (!startEl) return;
      startEl.disabled = selected === null;
    }

    function getSelected() {
      return selected;
    }

    function select(level) {
      setSelected(normalize(level, null), true);
    }

    function reset() {
      selected = null;
      setActive(0);
      optionEls.forEach(function (el) {
        el.setAttribute('aria-checked', 'false');
      });
      updateStart();
    }

    optionEls.forEach(function (el, i) {
      el.addEventListener('click', function () {
        setSelected(el.getAttribute('data-difficulty-option'), true);
      });

      el.addEventListener('keydown', function (e) {
        var direction = ARROW_KEYS[e.key];
        if (direction) {
          e.preventDefault();
          var next = activeIndex + direction;
          if (next < 0) next = optionEls.length - 1;
          if (next >= optionEls.length) next = 0;
          setActive(next);
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          setActive(0);
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          setActive(optionEls.length - 1);
          return;
        }
      });
    });

    if (startEl) {
      startEl.addEventListener('click', function () {
        if (selected !== null) onStart(selected);
      });
    }

    if (backEl) {
      backEl.addEventListener('click', onCancel);
    }

    var initial = normalize(options.initial, null);
    applyMeta();
    if (initial) {
      setSelected(initial, false);
    } else {
      setActive(0);
    }
    updateStart();

    return {
      getSelected: getSelected,
      select: select,
      reset: reset
    };
  }

  global.GameDifficulty = {
    LEVELS: LEVELS.slice(),
    normalize: normalize,
    create: create
  };
})(window);