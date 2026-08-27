const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// 📌 ID GRUP ASOSIASI PEMBURU ANIME
const ALLOWED_GROUPS = [
    '120363426460671438@g.us'
];

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n=============================================');
            console.log('QR Code baru dibuat! Buka qr.png untuk scan.');
            console.log('=============================================\n');
            await QRCode.toFile('./qr.png', qr);
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n=============================================');
            console.log(' BOT BERHASIL TERHUBUNG & AKTIF!');
            console.log('=============================================\n');
            if (fs.existsSync('./qr.png')) {
                fs.unlinkSync('./qr.png');
            }
        }
    });

    // EVENT: Sambutan Anggota Baru
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;

        if (!ALLOWED_GROUPS.includes(id)) {
            return;
        }

        if (action === 'add') {
            for (const item of participants) {
                const userJid = typeof item === 'string' ? item : (item.phoneNumber || item.id || String(item));
                const userPhone = userJid.split('@')[0];

                const welcomeText = 
`@${userPhone} ╭━━━〔 🌸 𝗔.𝗣.𝗔 𝗜𝗡𝗧𝗥𝗢 🌸 〕━━━╮
✦ 𝑷𝒆𝒓𝒌𝒆𝒏𝒂𝒍𝒂𝒏 𝑨𝒏𝒈𝒈𝒐𝒕𝒂 ✦
╰━━━━━━━━━━━━━━━━━━━━━━╯

୨୧ Nama : 
୨୧ Gender : 
୨୧ Kelas : 
୨୧ Anime Favorit : 
୨୧ Waifu / Husbu : 

╭─────────── ✦ ───────────╮
🎌 𝗦𝗮𝗹𝗮𝗺 𝗞𝗲𝗻𝗮 🎌
Semoga betah di keluarga anime ini ♡
╰─────────── ✦ ───────────╯

𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃
🌸 𝗬𝗼𝗿𝗼𝘀𝗵𝗶𝗸𝘂 𝗢𝗻𝗲𝗴𝗮𝗶𝘀𝗵𝗶𝗺𝒂𝘀𝘂! 🌸
𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃`;

                // 🖼️ Membaca gambar.jpeg dari folder lokal
                const imagePath = path.join(__dirname, 'gambar.jpeg');

                if (fs.existsSync(imagePath)) {
                    await sock.sendMessage(id, {
                        image: fs.readFileSync(imagePath),
                        caption: welcomeText,
                        mentions: [userJid]
                    });
                } else {
                    await sock.sendMessage(id, {
                        text: welcomeText,
                        mentions: [userJid]
                    });
                }

                console.log(`[BERHASIL] Sambutan foto Rem terkirim ke @${userPhone}`);
            }
        }
    });
}

connectToWhatsApp();