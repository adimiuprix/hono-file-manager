# Hono File Manager

File manager berbasis web yang ringan, dibuat dengan Hono
dan TypeScript, berjalan di runtime NPM. Kelola file dan folder kamu melalui antarmuka web yang intuitif dengan fitur seperti membuat, mengedit, menghapus, mengganti nama, dan mengorganisir file.

## Fitur

- **Antarmuka Web Modern**: Aplikasi satu halaman (Single Page Application) yang interaktif dan mulus tanpa perlu reload.
- **Navigasi Direktori**: Jelajahi folder dengan tampilan pohon yang dapat diciutkan
- **Operasi File**:
  - Lihat, edit, dan simpan file teks
  - Buat file dan folder baru
  - Unggah file
  - Unduh file
  - Hapus dan ganti nama item
- **Desain Responsif**: Berfungsi di perangkat desktop dan seluler
- **Fitur Pencarian**: Cepat temukan file dalam direktori saat ini
- **Ringan**: Ketergantungan minimal dan performa cepat

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd hofile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:8787`

3. File manager akan menyajikan file dari direktori `src/storage/`. Semua operasi dilakukan di sini dengan aman.

## Endpoint API

Aplikasi menyediakan REST API untuk operasi file:

- `GET /` - Sajikan HTML frontend
- `GET /api/list` - Daftar file dalam direktori
- `GET /api/file` - Dapatkan konten file
- `POST /api/save` - Simpan konten file
- `GET /api/download` - Unduh file
- `POST /api/mkdir` - Buat direktori
- `POST /api/delete` - Hapus file atau direktori
- `POST /api/rename` - Ganti nama file atau direktori
- `POST /api/upload` - Unggah file
- `GET /storage/*` - Sajikan file secara langsung

## Technologies Used

- [Hono](https://hono.dev/) - Web framework
- [nodejs](https://nodejs.org/en) - JavaScript runtime
- HTML, CSS, JavaScript - Frontend
- TypeScript - Backend server code

## License

This project is open source. See individual files for licensing details.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
