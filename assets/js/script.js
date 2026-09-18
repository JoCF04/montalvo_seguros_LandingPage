(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Referencia al recálculo de la barra de acento del índice de
     servicios (se asigna más abajo, si esa sección existe en la página).
     El cambio de idioma puede alterar cuántas líneas ocupa un nombre y
     por lo tanto la altura/posición del item activo, así que el swap de
     idioma también necesita poder reposicionar la barra. */
  var updateServiciosAccentBar = null;

  /* Referencia al recálculo de las líneas del titular del hero (se
     asigna más abajo). El swap de idioma reemplaza el texto del h1 por
     completo, así que también necesita poder re-dividirlo en líneas. */
  var updateHeroTitleLines = null;

  /* Año dinámico en el footer */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------
     Selector de idioma ES/EN
     Cada elemento traducible lleva data-es="..." y data-en="...". El
     idioma activo se guarda en localStorage y persiste entre páginas.
     Los textos generados por JS (mensajes de validación, aria-labels
     del menú) viven en este diccionario en vez de en el HTML.
     ------------------------------------------------------------------ */
  var i18n = {
    es: {
      menuOpen: 'Abrir menú de navegación',
      menuClose: 'Cerrar menú de navegación',
      errorNombre: 'Ingresa tu nombre completo.',
      errorEmail: 'Ingresa un correo electrónico válido.',
      errorTelefono: 'Ingresa un teléfono válido.',
      errorMensaje: 'Cuéntame un poco más (mínimo 10 caracteres).',
      statusInvalid: 'Revisa los campos marcados antes de enviar.',
      statusSending: 'Enviando mensaje...',
      statusSuccess: 'Gracias por escribir. Te contactaré a la brevedad.',
      statusError: 'No se pudo enviar el mensaje. Intenta nuevamente o escríbeme por WhatsApp.',
      toastSuccessTitle: 'Mensaje enviado',
      toastErrorTitle: 'No se pudo enviar',
      toastClose: 'Cerrar aviso'
    },
    en: {
      menuOpen: 'Open navigation menu',
      menuClose: 'Close navigation menu',
      errorNombre: 'Please enter your full name.',
      errorEmail: 'Please enter a valid email address.',
      errorTelefono: 'Please enter a valid phone number.',
      errorMensaje: 'Tell me a bit more (minimum 10 characters).',
      statusInvalid: 'Please check the highlighted fields before sending.',
      statusSending: 'Sending message...',
      statusSuccess: 'Thanks for reaching out. I will get back to you shortly.',
      statusError: 'The message could not be sent. Please try again or message me on WhatsApp.',
      toastSuccessTitle: 'Message sent',
      toastErrorTitle: 'Could not send',
      toastClose: 'Dismiss notification'
    }
  };

  var currentLang = localStorage.getItem('lang') === 'en' ? 'en' : 'es';

  function t(key) {
    return i18n[currentLang][key];
  }

  function applyLanguage(lang, immediate) {
    currentLang = lang;

    var swap = function () {
      document.documentElement.setAttribute('lang', lang);

      document.querySelectorAll('[data-' + lang + ']').forEach(function (el) {
        el.textContent = el.getAttribute('data-' + lang);
      });

      document.querySelectorAll('[data-aria-' + lang + ']').forEach(function (el) {
        el.setAttribute('aria-label', el.getAttribute('data-aria-' + lang));
      });

      var titleAttr = document.body.getAttribute('data-title-' + lang);
      if (titleAttr) {
        document.title = titleAttr;
      }

      var langToggleEl = document.getElementById('lang-toggle');
      if (langToggleEl) {
        langToggleEl.textContent = lang === 'es' ? 'EN' : 'ES';
      }

      var navToggleEl = document.getElementById('nav-toggle');
      if (navToggleEl && navToggleEl.getAttribute('aria-expanded') !== 'true') {
        navToggleEl.setAttribute('aria-label', t('menuOpen'));
      }

      document.body.classList.remove('lang-fade');

      /* El nombre del servicio activo puede envolver distinto en el otro
         idioma, cambiando la altura/posición del item: la barra de
         acento necesita reubicarse una vez que el nuevo texto ya se
         pintó (por eso el rAF, para esperar al siguiente frame). */
      if (updateServiciosAccentBar) {
        window.requestAnimationFrame(updateServiciosAccentBar);
      }

      /* El swap ya reemplazó el texto del h1 por el del nuevo idioma
         (perdiendo las líneas que había armado JS); hay que re-dividirlo
         en sus nuevas líneas visuales. */
      if (updateHeroTitleLines) {
        window.requestAnimationFrame(updateHeroTitleLines);
      }
    };

    if (immediate || prefersReducedMotion) {
      swap();
      return;
    }

    document.body.classList.add('lang-fade');
    window.setTimeout(swap, 150);
  }

  applyLanguage(currentLang, true);

  /* Titular del hero: entrada línea por línea (no todo el bloque de
     golpe). Las líneas dependen del ancho de columna y del idioma, así
     que en vez de fijarlas a mano en el HTML, se arman por JS: cada
     palabra se envuelve en un span temporal, se agrupan por su
     offsetTop (palabras con el mismo offsetTop están en la misma línea
     visual) y cada grupo se reescribe como un .hero-title-line con su
     propio animation-delay. El h1 se oculta (opacity inline) hasta que
     la primera división esté lista, para no mostrar un instante el
     texto sin dividir. */
  var heroTitle = document.getElementById('hero-title');

  if (heroTitle && !prefersReducedMotion) {
    var heroSubtitleEl = document.querySelector('.hero-subtitle');
    var heroActionsEl = document.querySelector('.hero-actions');
    var TITLE_LINE_BASE_DELAY = 0.16;
    var TITLE_LINE_STAGGER = 0.09;
    var POST_TITLE_GAP = 0.11;

    /* La entrada del titular es un momento único, al cargar la página.
       Cada vez que se re-divide el h1 se crean spans nuevos, y un span
       nuevo con la animación puesta arranca otra vez desde opacity:0: sin
       esta bandera, cualquier resize hacía DESAPARECER el titular y lo
       volvía a animar. En un teléfono eso pasa cada vez que la barra de
       URL se colapsa al hacer scroll. Una vez que la entrada terminó, las
       divisiones siguientes se pintan ya visibles. */
    var heroIntroDone = false;

    /* Solo el ANCHO cambia dónde corta cada línea. Guardar el último ancho
       y salir temprano si no cambió evita todo el trabajo (y todo riesgo
       de parpadeo) en el caso más frecuente en mobile: el resize de solo
       altura que dispara la barra de URL al aparecer y desaparecer. */
    var lastHeroWidth = window.innerWidth;

    heroTitle.style.opacity = '0';

    var splitHeroTitleLines = function () {
      /* Se lee siempre del atributo data-es/data-en (nunca de
         heroTitle.textContent): una segunda pasada (font-ready, resize)
         corre sobre un h1 que ya quedó dividido en líneas, y entre
         .hero-title-line no se inserta espacio (no hace falta
         visualmente, son bloques separados) — leer textContent en ese
         punto uniría la última palabra de una línea con la primera de
         la siguiente. El atributo, en cambio, nunca se toca. */
      var text = (heroTitle.getAttribute('data-' + currentLang) || heroTitle.textContent).trim();
      if (!text) return;
      var words = text.split(/\s+/);

      var measureFrag = document.createDocumentFragment();
      var wordEls = words.map(function (word, i) {
        var span = document.createElement('span');
        span.textContent = word;
        measureFrag.appendChild(span);
        if (i < words.length - 1) {
          measureFrag.appendChild(document.createTextNode(' '));
        }
        return span;
      });
      heroTitle.textContent = '';
      heroTitle.appendChild(measureFrag);

      var lines = [];
      var lastTop = null;
      wordEls.forEach(function (span) {
        var top = span.offsetTop;
        if (top !== lastTop) {
          lines.push([]);
          lastTop = top;
        }
        lines[lines.length - 1].push(span);
      });

      heroTitle.textContent = '';
      lines.forEach(function (lineWords, index) {
        var lineEl = document.createElement('span');
        lineEl.className = 'hero-title-line';

        if (heroIntroDone) {
          /* Re-división posterior a la entrada (resize, fuentes, cambio de
             idioma): el titular ya se mostró, así que estas líneas nacen
             visibles y sin animación. */
          lineEl.style.animation = 'none';
          lineEl.style.opacity = '1';
        } else {
          lineEl.style.animationDelay = (TITLE_LINE_BASE_DELAY + index * TITLE_LINE_STAGGER) + 's';
        }

        lineWords.forEach(function (word, wi) {
          lineEl.appendChild(word);
          if (wi < lineWords.length - 1) {
            lineEl.appendChild(document.createTextNode(' '));
          }
        });
        heroTitle.appendChild(lineEl);

        /* Espacio explícito ENTRE líneas. Visualmente no cambia nada (son
           bloques, el nodo colapsa), pero sin él todo lo que lee texto del
           DOM -un lector de pantalla, un buscador, copiar y pegar- recibía
           las palabras del corte pegadas: "Más de 34 añosprotegiendo la". */
        if (index < lines.length - 1) {
          heroTitle.appendChild(document.createTextNode(' '));
        }
      });

      heroTitle.style.opacity = '';

      var lastLineDelay = TITLE_LINE_BASE_DELAY + (lines.length - 1) * TITLE_LINE_STAGGER;
      if (heroSubtitleEl) heroSubtitleEl.style.animationDelay = (lastLineDelay + POST_TITLE_GAP) + 's';
      if (heroActionsEl) heroActionsEl.style.animationDelay = (lastLineDelay + POST_TITLE_GAP + 0.12) + 's';

      if (!heroIntroDone) {
        /* Se marca como terminada cuando la última línea acabó de entrar,
           más un margen. A partir de ahí ninguna re-división vuelve a
           ocultar el titular. */
        window.setTimeout(function () {
          heroIntroDone = true;
        }, (lastLineDelay + 0.7 + 0.2) * 1000);
      }
    };

    updateHeroTitleLines = splitHeroTitleLines;
    splitHeroTitleLines();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        window.requestAnimationFrame(splitHeroTitleLines);
      });
    }

    window.addEventListener('resize', function () {
      if (window.innerWidth === lastHeroWidth) return;
      lastHeroWidth = window.innerWidth;
      window.requestAnimationFrame(splitHeroTitleLines);
    });
  }

  var langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      var next = currentLang === 'es' ? 'en' : 'es';
      localStorage.setItem('lang', next);
      applyLanguage(next);
    });
  }

  /* Menú mobile */
  var navToggle = document.getElementById('nav-toggle');
  var navMenu = document.getElementById('nav-menu');
  var siteHeader = document.querySelector('.site-header');

  /* El panel de navegación es un position:fixed a pantalla completa, así
     que mientras está abierto el resto de la página tiene que quedar
     inmóvil e inalcanzable. Sin esto pasaban dos cosas: el contenido de
     atrás seguía haciendo scroll bajo el panel (muy notorio en iOS), y
     con Tab se salía del menú hacia links que están tapados y no se ven.
     Se guarda la posición de scroll antes de bloquear y se restaura al
     cerrar, porque position:fixed sobre el body la pierde. */
  var scrollLockY = 0;

  function lockBodyScroll() {
    scrollLockY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollLockY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollLockY);
  }

  /* El menú a pantalla completa solo existe bajo 860px; en desktop el nav
     es una fila más del header y no debe bloquear nada. */
  function navIsOverlay() {
    return window.matchMedia('(max-width: 859.98px)').matches;
  }

  function menuFocusables() {
    return Array.prototype.filter.call(
      navMenu.querySelectorAll('a[href], button'),
      function (el) { return el.offsetWidth > 0 || el.offsetHeight > 0; }
    );
  }

  var navClose = document.getElementById('nav-close');

  function closeMenu() {
    if (!navMenu.classList.contains('is-open')) return;
    navMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', t('menuOpen'));
    document.body.classList.remove('menu-open');
    if (navIsOverlay()) unlockBodyScroll();
    if (mainEl) mainEl.removeAttribute('inert');
    if (footerEl) footerEl.removeAttribute('inert');
  }

  function openMenu() {
    navMenu.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', t('menuClose'));
    if (siteHeader) siteHeader.classList.remove('header-hidden');
    /* menu-open anula el transform del header mientras el panel está
       abierto. Sin eso, un header a medio animar convierte al panel fixed
       en hijo posicionado suyo y le arranca la X de la pantalla. */
    document.body.classList.add('menu-open');
    if (navIsOverlay()) lockBodyScroll();
    /* inert saca del foco y de los lectores de pantalla todo lo que quedó
       detrás del panel, que es exactamente lo que se ve. */
    if (mainEl) mainEl.setAttribute('inert', '');
    if (footerEl) footerEl.setAttribute('inert', '');

    /* El foco entra al panel por el botón de cerrar: es el primer control
       del ciclo y garantiza que quien navega con teclado o lector de
       pantalla sepa de inmediato cómo salir. */
    if (navClose && navIsOverlay()) {
      window.requestAnimationFrame(function () { navClose.focus(); });
    }
  }

  var mainEl = document.getElementById('contenido');
  var footerEl = document.querySelector('.site-footer');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var isOpen = navMenu.classList.contains('is-open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    if (navClose) {
      navClose.addEventListener('click', function () {
        closeMenu();
        navToggle.focus();
      });
    }

    document.addEventListener('keydown', function (event) {
      if (!navMenu.classList.contains('is-open')) return;

      if (event.key === 'Escape') {
        closeMenu();
        navToggle.focus();
        return;
      }

      /* Trampa de foco: con el resto de la página en inert, Tab podría
         escaparse a la barra del navegador y dejar el panel abierto sin
         foco dentro. El ciclo se cierra entre el botón de cerrar y el
         último control del panel. */
      if (event.key !== 'Tab') return;

      var focusables = menuFocusables();
      if (!focusables.length) return;

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    /* Si se cruza a desktop con el menú abierto, el panel deja de ser un
       overlay: hay que soltar el bloqueo y el inert o la página queda
       congelada sin nada que lo explique. */
    window.addEventListener('resize', function () {
      if (!navIsOverlay() && navMenu.classList.contains('is-open')) {
        closeMenu();
      }
    });
  }

  /* Header que se oculta al bajar y reaparece al subir, o cuando el
     cursor se acerca a la parte superior de la ventana. Se omite por
     completo si el usuario prefiere menos movimiento. */
  if (siteHeader && !prefersReducedMotion) {
    var lastScrollY = window.scrollY;
    var tickingHeader = false;

    var updateHeader = function () {
      var currentScrollY = window.scrollY;
      var scrollingDown = currentScrollY > lastScrollY;
      var pastHeader = currentScrollY > siteHeader.offsetHeight;
      var menuOpen = navMenu && navMenu.classList.contains('is-open');

      if (scrollingDown && pastHeader && !menuOpen) {
        siteHeader.classList.add('header-hidden');
      } else {
        siteHeader.classList.remove('header-hidden');
      }

      lastScrollY = currentScrollY;
      tickingHeader = false;
    };

    window.addEventListener('scroll', function () {
      if (!tickingHeader) {
        window.requestAnimationFrame(updateHeader);
        tickingHeader = true;
      }
    }, { passive: true });
  }

  /* Parallax sutil de la foto del hero: al bajar, la foto se desplaza a
     una fracción de la velocidad del resto de la página (efecto de
     profundidad). Se aplica sobre .hero-photo-inner (no sobre el <img>)
     porque el <img> ya tiene su propia animación CSS de Ken Burns
     (transform: scale); si el parallax también escribiera transform en
     el <img> por JS, la animación CSS ganaría siempre esa propiedad y el
     parallax nunca se vería. El offset queda acotado a ±40px, dentro del
     16% de holgura vertical que .hero-photo-inner ya tiene de sobra
     (ver comentario en styles.css), así que nunca deja ver un borde. */
  var heroPhotoInner = document.querySelector('.hero#inicio .hero-photo-inner');

  if (heroPhotoInner && !prefersReducedMotion) {
    var heroSection = document.querySelector('.hero#inicio');
    var tickingParallax = false;

    var updateParallax = function () {
      var rect = heroSection.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        var offset = Math.max(-40, Math.min(40, rect.top * -0.08));
        heroPhotoInner.style.transform = 'translateY(' + offset + 'px)';
      }
      tickingParallax = false;
    };

    updateParallax();

    window.addEventListener('scroll', function () {
      if (!tickingParallax) {
        window.requestAnimationFrame(updateParallax);
        tickingParallax = true;
      }
    }, { passive: true });

    window.addEventListener('resize', updateParallax);
  }

  /* Servicios: índice + panel de lectura.
     - Desktop (>=860px): el nombre seleccionado cambia de color/peso en la
       lista de la izquierda; el panel de la derecha muestra su contenido
       con un fundido breve. El contenido no se escribe dos veces: se
       clona desde el panel móvil de cada item (que ya trae el texto
       correcto en el idioma activo, gracias a data-es/data-en).
     - Mobile (<860px): cada item se comporta como acordeón simple, un
       panel a la vez, igual que el resto de acordeones del sitio. */
  var serviciosIndex = document.getElementById('servicios-index');

  if (serviciosIndex) {
    var servicioItems = serviciosIndex.querySelectorAll('.servicio-item');
    var readingPanel = document.getElementById('servicios-reading');
    var readingNumber = document.getElementById('servicios-reading-number');
    var readingContent = document.getElementById('servicios-reading-content');
    var listWrap = serviciosIndex.querySelector('.servicios-list-wrap');
    var accentBar = document.getElementById('servicios-accent-bar');
    var isDesktopServicios = function () {
      return window.matchMedia('(min-width: 860px)').matches;
    };
    var activeServicioIndex = 0;

    function renderReadingPanel(item, index, animate) {
      if (!readingPanel) return;

      var nameEl = item.querySelector('.servicio-name');
      var textEl = item.querySelector('.servicio-panel-mobile-inner p');
      var number = String(index + 1).padStart(2, '0');

      var update = function () {
        if (readingNumber) readingNumber.textContent = number;

        readingContent.innerHTML = '';

        var heading = document.createElement('h3');
        heading.className = 'servicios-reading-name';
        var esName = nameEl.getAttribute('data-es');
        var enName = nameEl.getAttribute('data-en');
        if (esName) heading.setAttribute('data-es', esName);
        if (enName) heading.setAttribute('data-en', enName);
        heading.textContent = nameEl.textContent;

        var paragraph = textEl.cloneNode(true);
        paragraph.className = 'servicios-reading-text';

        readingContent.appendChild(heading);
        readingContent.appendChild(paragraph);
      };

      if (animate && !prefersReducedMotion) {
        readingPanel.classList.add('is-fading');
        window.setTimeout(function () {
          update();
          readingPanel.classList.remove('is-fading');
        }, 150);
      } else {
        update();
      }
    }

    /* Mueve la barra naranja compartida hasta la posición real del item
       activo (translateY + height), en vez de tener una barra por item
       que aparece/desaparece: así se percibe como un solo indicador que
       se desliza de un lugar a otro. */
    function updateAccentBar() {
      if (!accentBar || !listWrap || !isDesktopServicios()) return;
      var activeItem = servicioItems[activeServicioIndex];
      if (!activeItem) return;

      /* Si el grupo que contiene al ítem activo está plegado, el ítem no se
         ve y la barra no tiene nada que señalar. Antes seguía dibujándose
         igual: conservaba su altura y quedaba flotando fuera de la lista
         -.servicios-list-wrap no recorta el desbordamiento-, colándose en
         la sección de abajo. Como vive en x=0 del contenedor, aterrizaba
         justo sobre el margen izquierdo del rótulo "CONVENIO VIGENTE" de
         Alianzas y parecía un adorno de esa sección. Se reproducía así:
         elegir un servicio y después plegar su grupo. */
      var group = activeItem.closest('.servicio-group');
      if (!group || !group.classList.contains('is-open')) {
        accentBar.style.height = '0px';
        return;
      }

      var itemRect = activeItem.getBoundingClientRect();
      var wrapRect = listWrap.getBoundingClientRect();
      accentBar.style.transform = 'translateY(' + (itemRect.top - wrapRect.top) + 'px)';
      accentBar.style.height = itemRect.height + 'px';
    }

    /* El mismo botón cumple dos papeles según el ancho, y el ARIA tiene
       que decir cuál está cumpliendo:
       - En mobile abre y cierra el panel que tiene justo debajo, así que
         aria-expanded/aria-controls apuntan a ese panel: es un acordeón.
       - En desktop ese panel está en display:none y el texto sale en el
         panel de lectura compartido de la derecha. El botón deja de
         expandir nada propio y pasa a comportarse como una pestaña, así
         que se anuncia con aria-controls hacia el panel compartido y
         aria-expanded solo en el activo.
       Antes aria-expanded se quedaba en "false" para siempre en desktop
       -incluso en el servicio activo, con su texto visible al lado- y
       aria-controls señalaba un elemento oculto. */
    function syncServicioAria() {
      var desktop = isDesktopServicios();
      servicioItems.forEach(function (it, i) {
        var trigger = it.querySelector('.servicio-trigger');
        var panel = it.querySelector('.servicio-panel-mobile');
        if (desktop) {
          trigger.setAttribute('aria-controls', 'servicios-reading-content');
          trigger.setAttribute('aria-expanded', i === activeServicioIndex ? 'true' : 'false');
          panel.setAttribute('aria-hidden', 'true');
        } else {
          trigger.setAttribute('aria-controls', panel.id);
          var open = it.classList.contains('is-open');
          trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
          panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
      });
    }

    function setActiveServicio(index, animate) {
      activeServicioIndex = index;
      servicioItems.forEach(function (it, i) {
        it.classList.toggle('is-active', i === index);
      });
      renderReadingPanel(servicioItems[index], index, animate);
      updateAccentBar();
      syncServicioAria();
    }

    updateServiciosAccentBar = updateAccentBar;

    servicioItems.forEach(function (item, index) {
      var trigger = item.querySelector('.servicio-trigger');
      var panel = item.querySelector('.servicio-panel-mobile');

      trigger.addEventListener('click', function () {
        var mobileMode = !isDesktopServicios();

        if (mobileMode) {
          var wasOpen = item.classList.contains('is-open');

          servicioItems.forEach(function (other) {
            other.classList.remove('is-open');
            other.querySelector('.servicio-trigger').setAttribute('aria-expanded', 'false');
            other.querySelector('.servicio-panel-mobile').setAttribute('aria-hidden', 'true');
          });

          if (!wasOpen) {
            item.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            panel.setAttribute('aria-hidden', 'false');
          }
        }

        if (index !== activeServicioIndex) {
          setActiveServicio(index, !mobileMode);
        } else {
          syncServicioAria();
        }
      });
    });

    /* El primer servicio queda seleccionado por defecto: el panel de
       lectura nunca empieza vacío. */
    setActiveServicio(0, false);

    /* Recalcula la posición de la barra si cambia el ancho de la ventana
       (por ejemplo, al cruzar el breakpoint de 860px, o si el contenido
       de un item cambia de alto por el idioma activo). No dispara el
       fundido del panel, solo reposiciona. */
    window.addEventListener('resize', function () {
      window.requestAnimationFrame(function () {
        updateAccentBar();
        syncServicioAria();
      });
    });

    /* Grupos plegables ("Personales" / "Patrimoniales"): toggle estándar,
       pero exclusivo entre sí. Abrir uno cierra el otro (la lista nunca
       muestra ambos a la vez), y volver a hacer clic sobre el que ya está
       abierto lo cierra, dejando la lista completamente colapsada — un
       estado válido, no uno a evitar. Cada panel usa la misma cortina
       (grid-template-rows + fundido de opacity) que ya usa el acordeón
       móvil de cada servicio, y como el cierre de uno y la apertura del
       otro corren en paralelo con la misma duración/curva, el grupo que se
       abre "sube" de forma fluida hacia el espacio que deja el que se
       cierra en vez de saltar de golpe.
       Colapsar/expandir puede mover al item activo (si vive debajo, o si
       el propio grupo cambia de alto), así que la barra se reposiciona al
       iniciar el toggle -en paralelo con la cortina- y otra vez al
       terminar la transición, para corregir cualquier desajuste (por
       ejemplo bajo prefers-reduced-motion, donde la cortina no anima y
       salta directo al valor final).
       inert oculta el contenido colapsado de teclado y lectores de
       pantalla: sin esto, los botones de servicio dentro de un grupo
       cerrado seguirían siendo alcanzables con Tab aunque estén ocultos
       visualmente (a diferencia del acordeón móvil, acá sí hay controles
       interactivos -no solo texto- dentro del panel que se colapsa).
       Al terminar de ABRIR un grupo, su encabezado se lleva a la vista si
       hiciera falta (scrollIntoView con block:"nearest", que no mueve nada
       si ya está visible): así, si "Patrimoniales" estaba más abajo de
       lo que deja "Personales" al cerrarse, el usuario no tiene que buscarlo.
       Al cerrar no se hace ese ajuste: el encabezado sobre el que se acaba
       de hacer clic ya está, por definición, bajo el cursor. */
    var servicioGroups = serviciosIndex.querySelectorAll('.servicio-group');
    var GROUP_TRANSITION_MS = 300;

    function setServicioGroupOpen(group, isOpen) {
      var groupHeader = group.querySelector('.servicio-group-header');
      var groupPanel = group.querySelector('.servicio-group-panel');

      group.classList.toggle('is-open', isOpen);
      groupHeader.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      groupPanel.toggleAttribute('inert', !isOpen);
    }

    servicioGroups.forEach(function (group) {
      var groupHeader = group.querySelector('.servicio-group-header');
      var groupPanel = group.querySelector('.servicio-group-panel');

      groupPanel.toggleAttribute('inert', !group.classList.contains('is-open'));

      groupHeader.addEventListener('click', function () {
        var willOpen = !group.classList.contains('is-open');

        servicioGroups.forEach(function (otherGroup) {
          setServicioGroupOpen(otherGroup, otherGroup === group && willOpen);
        });

        updateAccentBar();

        if (!prefersReducedMotion) {
          groupPanel.addEventListener('transitionend', function onEnd(event) {
            if (event.target === groupPanel) {
              updateAccentBar();
              groupPanel.removeEventListener('transitionend', onEnd);
            }
          });
        }

        if (willOpen) {
          window.setTimeout(function () {
            groupHeader.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
          }, prefersReducedMotion ? 0 : GROUP_TRANSITION_MS);
        }
      });
    });
  }

  /* Preguntas frecuentes: acordeón simple, uno abierto a la vez. Reusa la
     misma cortina (grid-template-rows) que el índice de servicios, así que
     no necesita medir alturas ni escribir estilos en línea. A diferencia
     del acordeón de servicios, acá no hace falta inert: lo que se colapsa
     es solo texto, sin controles enfocables dentro. */
  var faqItems = document.querySelectorAll('.faq-item');

  if (faqItems.length) {
    faqItems.forEach(function (item) {
      var trigger = item.querySelector('.faq-trigger');
      var panel = item.querySelector('.faq-panel');

      trigger.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');

        faqItems.forEach(function (other) {
          other.classList.remove('is-open');
          other.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* Transición suave al navegar entre páginas internas (index.html /
     sobre-nosotros.html). Los enlaces de solo ancla (#seccion) se excluyen
     para conservar el scroll suave nativo dentro de la misma página. */
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (link.target === '_blank') return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var isExternal = /^https?:\/\//i.test(href) || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0;
    if (isExternal) return;

    if (prefersReducedMotion) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');
    window.setTimeout(function () {
      window.location.href = href;
    }, 200);
  });

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      document.body.classList.remove('is-leaving');
    }
  });

  /* Aviso emergente (toast) para el resultado del envío.
     Solo se usa para el DESENLACE del envío (enviado / no se pudo). Los
     errores de validación siguen en línea, junto a los campos, que es
     donde el usuario tiene que mirar para corregirlos: sacarlos a una
     esquina de la pantalla haría más difícil arreglarlos, no más fácil.
     Un aviso a la vez: si llega uno nuevo, el anterior se retira. */
  var toastRegion = document.getElementById('toast-region');
  var toastTimer = null;
  var TOAST_MS = 6000;

  function dismissToast(toast) {
    if (!toast || toast.dataset.leaving === '1') return;
    toast.dataset.leaving = '1';

    if (prefersReducedMotion) {
      toast.remove();
      return;
    }

    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');
    toast.addEventListener('transitionend', function handler(event) {
      if (event.target !== toast || event.propertyName !== 'opacity') return;
      toast.removeEventListener('transitionend', handler);
      toast.remove();
    });
  }

  function showToast(type, message) {
    if (!toastRegion) return;

    window.clearTimeout(toastTimer);
    Array.prototype.forEach.call(toastRegion.children, dismissToast);

    var toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' is-error' : '');

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = type === 'error'
      ? '<svg viewBox="0 0 20 20"><path d="M10 6v5M10 14h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
      : '<svg viewBox="0 0 20 20"><path d="M6 10.4l2.6 2.6L14.4 7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

    var body = document.createElement('div');
    body.className = 'toast-body';

    var title = document.createElement('p');
    title.className = 'toast-title';
    title.textContent = type === 'error' ? t('toastErrorTitle') : t('toastSuccessTitle');

    var text = document.createElement('p');
    text.className = 'toast-text';
    text.textContent = message;

    body.appendChild(title);
    body.appendChild(text);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', t('toastClose'));
    close.innerHTML = '&times;';
    close.addEventListener('click', function () {
      window.clearTimeout(toastTimer);
      dismissToast(toast);
    });

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    toastRegion.appendChild(toast);

    /* Dos frames antes de marcarlo visible: en uno solo el navegador
       puede agrupar la inserción y el cambio de clase en el mismo estilo
       calculado y la transición no llega a correr. */
    if (!prefersReducedMotion) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          toast.classList.add('is-visible');
        });
      });
    }

    toastTimer = window.setTimeout(function () {
      dismissToast(toast);
    }, TOAST_MS);

    return toast;
  }

  /* Validación y envío del formulario de contacto */
  var form = document.getElementById('contact-form');

  if (form) {
    var fields = {
      nombre: {
        input: document.getElementById('nombre'),
        error: document.getElementById('error-nombre'),
        validate: function (value) {
          return value.trim().length >= 2 ? '' : t('errorNombre');
        }
      },
      email: {
        input: document.getElementById('email'),
        error: document.getElementById('error-email'),
        validate: function (value) {
          var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return re.test(value.trim()) ? '' : t('errorEmail');
        }
      },
      telefono: {
        input: document.getElementById('telefono'),
        error: document.getElementById('error-telefono'),
        validate: function (value) {
          var re = /^[0-9+()\s-]{6,20}$/;
          return re.test(value.trim()) ? '' : t('errorTelefono');
        }
      },
      mensaje: {
        input: document.getElementById('mensaje'),
        error: document.getElementById('error-mensaje'),
        validate: function (value) {
          return value.trim().length >= 10 ? '' : t('errorMensaje');
        }
      }
    };

    function validateField(field) {
      var message = field.validate(field.input.value);
      field.error.textContent = message;
      field.input.closest('.form-field').classList.toggle('has-error', Boolean(message));
      return !message;
    }

    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      field.input.addEventListener('blur', function () {
        validateField(field);
      });
      field.input.addEventListener('input', function () {
        if (field.input.closest('.form-field').classList.contains('has-error')) {
          validateField(field);
        }
      });
    });

    var honeypot = document.getElementById('empresa_web');
    var submitBtn = document.getElementById('btn-submit');
    var statusEl = document.getElementById('form-status');

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (honeypot && honeypot.value.trim() !== '') {
        return;
      }

      var isValid = true;
      Object.keys(fields).forEach(function (key) {
        if (!validateField(fields[key])) {
          isValid = false;
        }
      });

      if (!isValid) {
        statusEl.textContent = t('statusInvalid');
        statusEl.className = 'form-status is-error';
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = t('statusSending');
      statusEl.className = 'form-status';

      var onSuccess = function () {
        /* El desenlace se cuenta en el aviso emergente, así que el texto
           en línea se limpia: si no, el mismo mensaje quedaría dicho dos
           veces, y un lector de pantalla lo anunciaría dos veces (ambos
           son regiones aria-live). */
        statusEl.textContent = '';
        statusEl.className = 'form-status';
        form.reset();
        showToast('success', t('statusSuccess'));
      };

      var onFailure = function () {
        /* Acá el texto en línea SÍ se conserva: menciona el WhatsApp como
           salida alternativa, y esa sigue estando disponible después de
           que el aviso se haya cerrado solo. */
        statusEl.textContent = t('statusError');
        statusEl.className = 'form-status is-error';
        showToast('error', t('statusError'));
      };

      /* Modo demostración: con ?demo=1 en la URL, el envío no sale a la
         red y se responde con el aviso de éxito. Existe para poder
         enseñar el formulario funcionando mientras el access_key de
         Web3Forms siga siendo el de ejemplo (con ese valor, un envío real
         siempre falla).
         Va atado a un parámetro de la URL, no a una constante del código,
         a propósito: así es imposible que quede activado por descuido en
         producción. Sin el parámetro -es decir, para cualquier visitante
         que llegue al sitio con normalidad- nunca se muestra una
         confirmación de algo que no se envió. */
      var demoMode = /[?&]demo=1(&|$)/.test(window.location.search);

      if (demoMode) {
        window.setTimeout(function () {
          onSuccess();
          submitBtn.disabled = false;
        }, 700);
        return;
      }

      var formData = new FormData(form);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (data.success) {
            onSuccess();
          } else {
            onFailure();
          }
        })
        .catch(onFailure)
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  /* Contador animado para "34 años" en sobre-nosotros.html: se dispara una
     sola vez, la primera vez que el texto entra en pantalla. */
  var counters = document.querySelectorAll('.counter');

  if (counters.length && 'IntersectionObserver' in window) {
    var animateCounter = function (el) {
      var target = parseInt(el.getAttribute('data-target'), 10) || 0;

      if (prefersReducedMotion) {
        el.textContent = target;
        return;
      }

      var duration = 1200;
      var startTime = null;

      function step(timestamp) {
        if (startTime === null) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        el.textContent = Math.floor(progress * target);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = target;
        }
      }

      window.requestAnimationFrame(step);
    };

    var counterObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) {
      counterObserver.observe(el);
    });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.getAttribute('data-target');
    });
  }

  /* Navegación lateral de sobre-nosotros.html: resalta la sección visible */
  var aboutNavLinks = document.querySelectorAll('.about-nav a');
  var aboutSections = document.querySelectorAll('.about-section');

  if (aboutNavLinks.length && aboutSections.length && 'IntersectionObserver' in window) {
    var linksByHash = {};
    aboutNavLinks.forEach(function (link) {
      linksByHash[link.getAttribute('href')] = link;
    });

    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linksByHash['#' + entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          aboutNavLinks.forEach(function (l) { l.classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });

    aboutSections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  /* Indicador de sección activa en el header de index.html. Cada link
     traducible del nav lleva data-section="inicio|servicios|nosotros|
     contacto"; eso desacopla la detección de scroll del href real (el
     link "Nosotros" apunta a otra página, no a un ancla de esta). */
  var headerNavLinks = document.querySelectorAll('#nav-menu .nav-link[data-section]');

  if (headerNavLinks.length && 'IntersectionObserver' in window) {
    var navByDataSection = {};
    headerNavLinks.forEach(function (link) {
      navByDataSection[link.getAttribute('data-section')] = link;
    });

    var spySections = ['inicio', 'servicios', 'nosotros', 'contacto']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    var headerNavObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = navByDataSection[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          headerNavLinks.forEach(function (l) { l.classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });

    spySections.forEach(function (section) {
      headerNavObserver.observe(section);
    });
  }
})();
