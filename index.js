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

 // 1. FITUR WELCOME MESSAGE (FORMAT INTRO ANIMATED/AESTHETIC)
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        const targetGroup = '120363426460671438@g.us';

        if (id === targetGroup && action === 'add') {
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

    // 2. FITUR DOWNLOADER MULTI-PLATFORM STABIL
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;
            const cleanUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];

            if (!cleanUrl) return;

            // A. DOWNLOADER TIKTOK (TikWM API)
            if (cleanUrl.includes('tiktok.com')) {
                await sock.sendMessage(from, { text: '⏳ *[TikTok Downloader]*\nSedang mengunduh video...' }, { quoted: msg });
                const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                const json = await res.json();

                if (json.data && json.data.play) {
                    await sock.sendMessage(from, {
                        video: { url: json.data.play },
                        caption: `✅ *${json.data.title || 'TikTok Video'}*`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: '❌ Gagal mengunduh video TikTok.' }, { quoted: msg });
                }
            }

            // B. DOWNLOADER INSTAGRAM & YOUTUBE (Cobalt API)
            else if (cleanUrl.includes('instagram.com') || cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
                const platform = cleanUrl.includes('instagram.com') ? 'Instagram' : 'YouTube';
                await sock.sendMessage(from, { text: `⏳ *[${platform} Downloader]*\nSedang memproses media...` }, { quoted: msg });

                const response = await fetch('https://api.cobalt.tools/api/json', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: cleanUrl })
                });

                const data = await response.json();

                if (data && data.url) {
                    await sock.sendMessage(from, {
                        video: { url: data.url },
                        caption: `✅ Berhasil diunduh dari *${platform}*!`
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: `❌ Gagal mengambil media dari ${platform}.` }, { quoted: msg });
                }
            }
        } catch (err) {
            console.error('Error Downloader:', err);
        }
    });
}

startBot();