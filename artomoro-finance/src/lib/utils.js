import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function terbilang(angka) {
  const bil = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (angka < 12) {
    return bil[angka];
  } else if (angka < 20) {
    return bil[angka - 10] + " Belas";
  } else if (angka < 100) {
    return bil[Math.floor(angka / 10)] + " Puluh " + bil[angka % 10];
  } else if (angka < 200) {
    return "Seratus " + terbilang(angka - 100);
  } else if (angka < 1000) {
    return bil[Math.floor(angka / 100)] + " Ratus " + terbilang(angka % 100);
  } else if (angka < 2000) {
    return "Seribu " + terbilang(angka - 1000);
  } else if (angka < 1000000) {
    return terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
  } else if (angka < 1000000000) {
    return terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
  } else if (angka < 1000000000000) {
    return terbilang(Math.floor(angka / 1000000000)) + " Milyar " + terbilang(angka % 1000000000);
  }
  return "";
}

export function formatTerbilang(amount) {
  const amt = Math.floor(Math.abs(amount))
  if (amt === 0) return "Nol Rupiah"
  const hasil = terbilang(amt)
  const result = hasil.replace(/\s+/g, ' ').trim() + " Rupiah"
  return amount < 0 ? "Minus " + result : result
}

export function getFormattedDateTimeIndo() {
  const now = new Date()
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  
  const dayName = days[now.getDay()]
  const date = now.getDate().toString().padStart(2, '0')
  const monthName = months[now.getMonth()]
  const year = now.getFullYear()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  
  return `${dayName}, ${date} ${monthName} ${year} - Pukul ${hours}:${minutes}:${seconds} WIB (Tangerang)`
}
