import { Component, signal, computed, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';

interface Ticket {
  id: string;
  name: string;
  tagline: string;
  price: number;
  benefits: string[];
  featured?: boolean;
  mask: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);

  // ── Configuración programador ─────────────────────────────
  readonly WHATSAPP_NUMBER = '542921421616';
  readonly BASE_GREETING = 'Holaa, quiero comprar entradas para';
  readonly EVENT_NAME = 'Noche de Máscaras';
  readonly EVENT_DATE_LABEL = 'Octubre 2026 · Monte Hermoso';
  readonly EVENT_VENUE = 'Monte Hermoso · te pasamos la dirección por WhatsApp';
  readonly EVENT_TARGET = new Date('2026-10-17T23:59:00-03:00').getTime();

  tickets = signal<Ticket[]>([
    {
      id: 'general',
      name: 'Primer preventa',
      tagline: 'Para vivir la noche completa',
      price: 10000,
      mask: '🎭',
      benefits: ['Acceso toda la noche 12 en adelante', 'DJs toda la noche'],
    },
  ]);

  quantities = signal<Record<string, number>>({ general: 1 });
  buyerName = signal('');
  buyerDni = signal('');
  showPreview = signal(false);
  toast = signal('');
  openFaq = signal<number | null>(0);

  // countdown
  days = signal(0);
  hours = signal(0);
  minutes = signal(0);
  seconds = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private observer: IntersectionObserver | null = null;

  faqs = [
    { q: '¿Cómo compro si no hay pago online?', a: 'Elegís la cantidad acá, tocás “Reservar por WhatsApp” y se abre el chat con tu pedido listo. Te confirmamos disponibilidad, te pasamos el alias, transferís y tu lugar queda guardado.' },
    { q: '¿El antifaz es obligatorio?', a: 'Si. Y hay una sorpresa al final para los que tengan puesto uno...' },
    { q: '¿Dónde es la fiesta?', a: 'En Monte Hermoso, en octubre. La dirección exacta te la pasamos por WhatsApp cuando confirmás tu reserva.' },
    { q: '¿Puedo cambiar el titular o revender mi entrada?', a: 'Sí, podés cambiar el nombre una vez sin costo avisando por WhatsApp con anticipación. En puerta pedimos DNI.' }
  ];

  totalTickets = computed(() => Object.values(this.quantities()).reduce((a, b) => a + b, 0));

  totalPrice = computed(() =>
    this.tickets().reduce((acc, t) => acc + (this.quantities()[t.id] ?? 0) * t.price, 0)
  );

  detailLines = computed(() =>
    this.tickets()
      .filter((t) => (this.quantities()[t.id] ?? 0) > 0)
      .map((t) => {
        const q = this.quantities()[t.id];
        return `• ${q}x ${t.name.toUpperCase()} ($${(t.price * q).toLocaleString('es-AR')})`;
      })
  );

  whatsappMessage = computed(() => {
    const lines = this.detailLines();
    const nombre = this.buyerName().trim() || '[Mi nombre]';
    const dni = this.buyerDni().trim() ? ` (DNI: ${this.buyerDni().trim()})` : '';
    const detalle = lines.length ? lines.join('\n') : '• (Aún no elegí cantidad, quiero asesoramiento)';
    return (
      `${this.BASE_GREETING} *${this.EVENT_NAME} - KATRASKA* 🎭\n\n` +
      `${detalle}\n` +
      `Total estimado: *$${this.totalPrice().toLocaleString('es-AR')}*\n\n` +
      `Nombre: ${nombre}${dni}\n` +
      `Evento: ${this.EVENT_NAME} | ${this.EVENT_DATE_LABEL}\n` +
      `Lugar: ${this.EVENT_VENUE}\n\n` +
      `¿Me confirmás disponibilidad y cómo pagar?`
    );
  });

  whatsappUrl = computed(
    () => `https://wa.me/${this.WHATSAPP_NUMBER}?text=${encodeURIComponent(this.whatsappMessage())}`
  );

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('katraska-cart');
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, number>;
          const g = Math.max(0, Math.min(10, Number(parsed['general'] ?? 2) || 0));
          this.quantities.set({ general: g });
        }
        const savedName = localStorage.getItem('katraska-name');
        if (savedName) this.buyerName.set(savedName);
      } catch { /* noop */ }
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initParticles();
    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => this.observer?.observe(el));
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.observer?.disconnect();
  }

  private tick() {
    const diff = Math.max(0, this.EVENT_TARGET - Date.now());
    this.days.set(Math.floor(diff / 86400000));
    this.hours.set(Math.floor((diff / 3600000) % 24));
    this.minutes.set(Math.floor((diff / 60000) % 60));
    this.seconds.set(Math.floor((diff / 1000) % 60));
  }

  inc(id: string) {
    const q = { ...this.quantities() };
    q[id] = Math.min(10, (q[id] ?? 0) + 1);
    this.quantities.set(q);
    this.persist();
  }

  dec(id: string) {
    const q = { ...this.quantities() };
    q[id] = Math.max(0, (q[id] ?? 0) - 1);
    this.quantities.set(q);
    this.persist();
  }

  onNameChange(v: string) {
    this.buyerName.set(v);
    try { localStorage.setItem('katraska-name', v); } catch { /* noop */ }
  }

  private persist() {
    try { localStorage.setItem('katraska-cart', JSON.stringify(this.quantities())); } catch { /* noop */ }
  }

  formatPrice(n: number) {
    return '$' + n.toLocaleString('es-AR');
  }

  reserve() {
    if (this.totalTickets() === 0) {
      this.flash('Elegí al menos 1 entrada para continuar 🎭');
      document.getElementById('entradas')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    this.showPreview.set(true);
    setTimeout(() => document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  confirmWhatsApp() {
    if (!isPlatformBrowser(this.platformId)) return;
    window.open(this.whatsappUrl(), '_blank', 'noopener');
    this.flash('Abriendo WhatsApp con tu pedido preescrito… 🖤');
  }

  copyMessage() {
    if (!isPlatformBrowser(this.platformId)) return;
    navigator.clipboard.writeText(this.whatsappMessage()).then(
      () => this.flash('Mensaje copiado. Pegalo en WhatsApp 📋'),
      () => this.flash('No se pudo copiar, revisá el preview')
    );
  }

  private flash(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3200);
  }

  toggleFaq(i: number) {
    this.openFaq.set(this.openFaq() === i ? null : i);
  }

  private initParticles() {
    const canvas = document.getElementById('dust') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    const N = 90;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 2.2,
      s: 0.0004 + Math.random() * 0.0015,
      o: 0.15 + Math.random() * 0.6,
      gold: Math.random() > 0.4,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.y -= p.s;
        p.x += Math.sin(p.y * 20) * 0.0004;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const px = p.x * canvas.width;
        const py = p.y * canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? `rgba(201,168,106,${p.o})` : `rgba(237,230,214,${p.o * 0.7})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.gold ? 'rgba(201,168,106,0.8)' : 'transparent';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      requestAnimationFrame(loop);
    };
    loop();
  }
}
