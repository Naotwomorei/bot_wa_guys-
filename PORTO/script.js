let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const navItems = document.querySelectorAll('.nav-item');
const totalSlides = slides.length;
let isScrolling = false;

function goToSlide(index) {
    if (index < 0 || index >= totalSlides) return;
    
    // Hapus kelas aktif lama
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    if(navItems[currentSlide]) navItems[currentSlide].classList.remove('active');

    // Update indeks slide baru
    currentSlide = index;

    // Tambah kelas aktif baru (memicu transisi dissolve)
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    if(navItems[currentSlide]) navItems[currentSlide].classList.add('active');
}

// Navigasi lewat klik menu atas
navItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(index);
    });
});

// Fitur Pindah Slide pakai Scroll Mouse (Wheel) atau Tombol Panah Keyboard
window.addEventListener('wheel', (e) => {
    if (isScrolling) return;
    isScrolling = true;

    if (e.deltaY > 0) {
        // Scroll ke bawah (Slide Berikutnya)
        if (currentSlide < totalSlides - 1) {
            goToSlide(currentSlide + 1);
        }
    } else {
        // Scroll ke atas (Slide Sebelumnya)
        if (currentSlide > 0) {
            goToSlide(currentSlide - 1);
        }
    }

    setTimeout(() => {
        isScrolling = false;
    }, 1000); // jeda animasi 1 detik
}, { passive: true });

// Navigasi pakai Keyboard (Arrow Up / Arrow Down)
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        goToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        goToSlide(currentSlide - 1);
    }
});