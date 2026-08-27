const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

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

    // ==========================================
    // 1. FITUR WELCOME MESSAGE (FORMAT INTRO)
    // ==========================================
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        const targetGroup = '120363426460671438@g.us';

        if (id === targetGroup && action === 'add') {
            for (const participant of participants) {
                const captionText = `@${participant.split('@')[0]} ╭━━━〔 🌸 𝗔.𝗣.𝗔 𝗜𝗡𝗧𝗥𝗢 🌸 〕━━━╮
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
                            mentions: [participant]
                        });
                    } else {
                        await sock.sendMessage(id, {
                            text: captionText,
                            mentions: [participant]
                        });
                    }
                } catch (err) {
                    console.error('Gagal mengirim pesan welcome:', err);
                }
            }
        }
    });

    // ==========================================
    // 2. FITUR DOWNLOADER (TIKTOK, IG, YOUTUBE)
    // ==========================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;

            const isTiktok = text.includes('tiktok.com');
            const isInstagram = text.includes('instagram.com');
            const isYoutube = text.includes('youtube.com') || text.includes('youtu.be');

            if (isTiktok || isInstagram || isYoutube) {
                const platform = isTiktok ? 'TikTok' : isInstagram ? 'Instagram' : 'YouTube';
                
                await sock.sendMessage(from, { 
                    text: `⏳ *[${platform} Downloader]*\nSedang mengunduh media, tunggu sebentar ya...` 
                }, { quoted: msg });

                const apiUrl = `https://api.cobalt.tools/api/json`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: text.trim() })
                });

                const data = await response.json();

                if (data && data.url) {
                    await sock.sendMessage(from, {
                        video: { url: data.url },
                        caption: `✅ Berhasil diunduh dari *${platform}*!`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { 
                        text: `❌ Gagal mengambil media dari ${platform}. Pastikan akun/postingan tidak di-private.` 
                    }, { quoted: msg });
                }
            }
        } catch (err) {
            console.error('Error Downloader:', err);
        }
    });
}

startBot();