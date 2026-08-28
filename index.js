const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 📌 CONFIGURASI TARGET GRUP
// =========================================================================
const TARGET_GROUP = '120363426460671438@g.us'; // ID Grup Khusus Kamu

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ BOT BERHASIL TERHUBUNG & AKTIF!');
        } else if (connection === 'close') {
            console.log('🔄 Koneksi terputus, mencoba menghubungkan kembali...');
            startBot();
        }
    });

    // =========================================================================
    // 1. FITUR WELCOME MESSAGE (TETAP KHUSUS GRUP TARGET)
    // =========================================================================
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;

        // FILTER: Hanya jalan di Grup Target & saat ada anggota baru
        if (id === TARGET_GROUP && action === 'add') {
            for (const participant of participants) {
                const userJid = typeof participant === 'string' ? participant : (participant.id || participant.jid || '');
                if (!userJid) continue;

                const captionText = `@${userJid.split('@')[0]} ╭── [ 🌸 A.P.A INTRO 🌸 ] ──
✦ 𝑷𝒆𝒓𝒌𝒆𝒏𝒂𝒍𝒂𝒏 𝑨𝒏𝒈𝒈𝒐𝒕𝒂 ✦
╰━━━━━━━━━━━━━━━━━━━━━━╯

୨୧ Nama : 
୨୧ Gender : 
୨୧ Kelas : 
୨୧ Anime Favorit : 
୨୧ Waifu / Husbu : 

╭─────────── ✦ ───────────╮
🎌 𝗦𝗮𝗹𝗮𝗺 𝗞𝗲𝗻𝗮𝗹! 🎌
Semoga betah di keluarga anime ini ♡
╰─────────── ✦ ───────────╯

𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃
🌸 𝗬𝗼𝗿𝗼𝘀𝗵𝗶𝗸𝘂 𝗢𝗻𝗲𝗴𝗮𝗶𝘀𝗵𝗶𝗺𝗮𝘀𝘂! 🌸
𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃`;

                const imagePath = path.join(__dirname, 'gambar.jpeg');

                try {
                    if (fs.existsSync(imagePath)) {
                        await sock.sendMessage(id, {
                            image: fs.readFileSync(imagePath),
                            caption: captionText,
                            mentions: [userJid]
                        });
                    } else {
                        await sock.sendMessage(id, {
                            text: captionText,
                            mentions: [userJid]
                        });
                    }
                } catch (err) {
                    console.error('Gagal mengirim pesan welcome:', err);
                }
            }
        }
    });

    // =========================================================================
    // 2. FITUR DOWNLOADER MULTI-MEDIA (KHUSUS GRUP TARGET)
    // =========================================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;

            // 🔒 FILTER UTAMA: LGSG STOP JIKA PESAN BUKAN DARI GRUP TARGET!
            if (from !== TARGET_GROUP) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const cleanUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];

            if (!cleanUrl) return;

            // A. DOWNLOADER TIKTOK (TikWM API)
            if (cleanUrl.includes('tiktok.com')) {
                await sock.sendMessage(from, { text: '⏳ *[TikTok Downloader]*\nSedang mengunduh media...' }, { quoted: msg });
                const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                const json = await res.json();

                if (json.data) {
                    // Jika berupa Video
                    if (json.data.play) {
                        await sock.sendMessage(from, {
                            video: { url: json.data.play },
                            caption: `✅ *${json.data.title || 'TikTok Video'}*`
                        }, { quoted: msg });
                    } 
                    // Jika berupa Postingan Foto / Slide (Carousel)
                    else if (json.data.images && json.data.images.length > 0) {
                        for (const imgUrl of json.data.images) {
                            await sock.sendMessage(from, { image: { url: imgUrl } }, { quoted: msg });
                        }
                    }
                } else {
                    await sock.sendMessage(from, { text: '❌ Gagal mengunduh media TikTok.' }, { quoted: msg });
                }
            }

            // B. DOWNLOADER INSTAGRAM, YOUTUBE, FB, PINTEREST, DLL (Cobalt API)
            else if (
                cleanUrl.includes('instagram.com') || 
                cleanUrl.includes('youtube.com') || 
                cleanUrl.includes('youtu.be') ||
                cleanUrl.includes('facebook.com') ||
                cleanUrl.includes('pin.it') ||
                cleanUrl.includes('pinterest.com')
            ) {
                await sock.sendMessage(from, { text: `⏳ *[Media Downloader]*\nSedang memproses postingan/media...` }, { quoted: msg });

                const response = await fetch('https://api.cobalt.tools/api/json', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: cleanUrl })
                });

                const data = await response.json();

                if (data) {
                    // 1. Jika hasilnya Single Video / Single Image
                    if (data.url) {
                        const isImage = data.url.includes('.jpg') || data.url.includes('.png') || data.url.includes('.webp');
                        if (isImage) {
                            await sock.sendMessage(from, { image: { url: data.url }, caption: '✅ Foto berhasil diunduh!' }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { video: { url: data.url }, caption: '✅ Video berhasil diunduh!' }, { quoted: msg });
                        }
                    } 
                    // 2. Jika hasilnya Slide / Carousel Foto Banyak (Instagram Post)
                    else if (data.picker && data.picker.length > 0) {
                        for (const item of data.picker) {
                            if (item.type === 'photo') {
                                await sock.sendMessage(from, { image: { url: item.url } }, { quoted: msg });
                            } else if (item.type === 'video') {
                                await sock.sendMessage(from, { video: { url: item.url } }, { quoted: msg });
                            }
                        }
                    } else {
                        await sock.sendMessage(from, { text: '❌ Gagal mengambil media dari link tersebut.' }, { quoted: msg });
                    }
                }
            }
        } catch (err) {
            console.error('Error Downloader:', err);
        }
    });
}

startBot();