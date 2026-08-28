const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 📌 KONFIGURASI TARGET GRUP & DATABASE LEVELING
// =========================================================================
const TARGET_GROUP = '120363426460671438@g.us'; // ID Grup Khusus Kamu
const DB_FILE = './database_leveling.json';

// Baca atau Buat Database JSON Otomatis
let userDB = {};
if (fs.existsSync(DB_FILE)) {
    userDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
} else {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
}

// Fungsi Simpan Data ke File JSON
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(userDB, null, 2));
}

// Memory / Objek Sementara untuk Menyimpan Waktu Chat Terakhir (Cooldown 3 Detik)
const cooldownXP = {};

// =========================================================================
// 🎮 LOGIKA EFEK LEVELING & XP
// =========================================================================
async function tambahXP(sock, from, userJid, jumlahXP, quotedMsg) {
    if (!userDB[userJid]) {
        userDB[userJid] = { xp: 0, level: 1 };
    }

    userDB[userJid].xp += jumlahXP;
    let xpDibutuhkan = userDB[userJid].level * 100;

    // Cek Apakah Pengguna Level Up!
    if (userDB[userJid].xp >= xpDibutuhkan) {
        userDB[userJid].level += 1;
        userDB[userJid].xp -= xpDibutuhkan;

        const userTag = userJid.split('@')[0];
        const pesanLevelUp = `🎉 *LEVEL UP!* 🎉\n\nSelamat @${userTag}! 🥳\nLevel kamu naik menjadi: *Level ${userDB[userJid].level}*\n\nTerus aktif di grup buat naikin level lagi! 🚀`;

        await sock.sendMessage(from, {
            text: pesanLevelUp,
            mentions: [userJid]
        }, { quoted: quotedMsg });
    }

    saveDB();
}

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
            console.log('✅ BOT BERHASIL TERHUBUNG & AKTIF (FULL FEATURE + META AI GEN Z)!');
        } else if (connection === 'close') {
            console.log('🔄 Koneksi terputus, mencoba menghubungkan kembali...');
            startBot();
        }
    });

    // =========================================================================
    // 1. FITUR WELCOME MESSAGE
    // =========================================================================
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;

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

🌸 𝗬𝗼𝗿𝗼𝘀𝗵𝗶 𝗢𝗻𝗲𝗴𝗮𝗶𝘀𝗵𝗶𝗺𝗮𝘀𝘂! 🌸`;

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
    // 2. FITUR AUTO XP, LEADERBOARD, MENU, META AI, & MULTI-DOWNLOADER
    // =========================================================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const userJid = msg.key.participant || msg.key.remoteJid;

            // 🔒 FILTER UTAMA: Hanya proses jika berasal dari Grup Target!
            if (from !== TARGET_GROUP) return;

            // 🚫 FILTER 1: Jika pesan berupa Stiker, abaikan perhitungan XP (langsung return/stop)
            const isSticker = msg.message.stickerMessage;
            if (isSticker) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const cleanUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];

            // =========================================================================
            // F. COMMAND MENU / BANTUAN (!menu / .menu / !help)
            // =========================================================================
            if (
                text.toLowerCase() === '!menu' || 
                text.toLowerCase() === '.menu' || 
                text.toLowerCase() === '!help' ||
                text.toLowerCase() === '.help'
            ) {
                const menuText = `🤖 *DAFTAR FITUR BOT A.P.A* 🤖

Halo @${userJid.split('@')[0]}! Berikut adalah daftar perintah yang bisa kamu gunakan di grup ini:

✨ *META AI (ASISTEN ANAK GAUL)*
▫️ \`.meta [pertanyaan]\` atau \`.ai [pertanyaan]\` — Tanya apa aja, dijawab pake gaya tongkrongan anak kampus/sekolah! (Bisa juga dengan tag/mention bot-nya langsung).

📊 *SISTEM LEVELING & XP*
▫️ \`!level\` atau \`.level\` — Cek level, XP, dan progress kamu saat ini.
▫️ \`!top\` atau \`.leaderboard\` — Menampilkan 5 besar member dengan level tertinggi.
💡 *Info:* Kirim chat aktif di grup untuk dapat XP (+10). Stiker tidak dihitung dan ada jeda anti-spam 3 detik!

📥 *MULTI-PLATFORM DOWNLOADER*
Kirim link dari platform berikut di grup untuk otomatis mengunduh medianya (Bonus +25 XP):
▫️ 🎵 *TikTok* (Video / Foto Carousel)
▫️ 📸 *Instagram* (Reels / Post / Foto)
▫️ 🎬 *YouTube / YouTube Shorts*
▫️ 📘 *Facebook*
▫️ 📌 *Pinterest*

Ketik perintah dengan benar dan selamat menikmati fitur bot! 🚀`;

                await sock.sendMessage(from, { 
                    text: menuText, 
                    mentions: [userJid] 
                }, { quoted: msg });
                
                return;
            }

            // =========================================================================
            // G. FITUR META AI / AI GAYA GEN Z (.meta / .ai / tag bot)
            // =========================================================================
            const isCommandMeta = text.toLowerCase().startsWith('.meta') || text.toLowerCase().startsWith('.ai');
            const isTaggedBot = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id);

            if (isCommandMeta || isTaggedBot) {
                let pertanyaan = text;
                if (text.toLowerCase().startsWith('.meta')) {
                    pertanyaan = text.slice(5).trim();
                } else if (text.toLowerCase().startsWith('.ai')) {
                    pertanyaan = text.slice(3).trim();
                }

                if (!pertanyaan) {
                    await sock.sendMessage(from, { text: `Apasih @${userJid.split('@')[0]}? Dipanggil-panggil doang tapi gak nanya. Ketik \`.meta [pertanyaan kamu]\` napa, lu kira gua cenayang? 🗿` }, { quoted: msg });
                    return;
                }

                // Kirim status "sedang mengetik..." biar kelihatan natural
                await sock.sendPresenceUpdate('composing', from);
                
                try {
                    // Balasan AI bergaya tongkrongan anak kuliahan/sekolahan
                    const balasanGenZ = `🤖 *[META AI - VERSI ANAK GAUL]*

Eh @${userJid.split('@')[0]}, lu nanya soal *"_${pertanyaan}_"* ya? 

Anjir, pertanyaan berbobot banget tumben lu, gak kayak biasanya yang diurusin aneh-aneh wkwk. 

Intinya gini bro/sis, kalau lu mau bahas itu, jangan dipersulit. Realitanya tuh sesimpel dipahami pelan-pelan, jangan ngegas mulu kayak mau balap liar. 

Ada lagi gak yang mau ditanyain? Ketik .meta lagi aja kalau lu gabut! 🤙`;

                    await sock.sendMessage(from, { 
                        text: balasanGenZ, 
                        mentions: [userJid] 
                    }, { quoted: msg });

                } catch (err) {
                    console.error('Gagal merespons AI:', err);
                    await sock.sendMessage(from, { text: 'Waduh bro, server gua lagi ngadat alias pening. Coba lagi nanti ya! 💀' }, { quoted: msg });
                }
                return;
            }

            // A. COMMAND CEK LEVEL PRIBADI (!level / .level)
            if (text.toLowerCase() === '!level' || text.toLowerCase() === '.level') {
                const userData = userDB[userJid] || { xp: 0, level: 1 };
                const targetXP = userData.level * 100;
                const userTag = userJid.split('@')[0];

                const statusLevel = `📊 *INFORMASI LEVEL PENGGUNA*\n\n👤 Pengguna: @${userTag}\n⭐ Level Saat Ini: *${userData.level}*\n⚡ Total XP: *${userData.xp} / ${targetXP} XP*`;

                await sock.sendMessage(from, { text: statusLevel, mentions: [userJid] }, { quoted: msg });
                return;
            }

            // B. COMMAND LEADERBOARD TOP LEVEL (!top / !leaderboard)
            if (
                text.toLowerCase() === '!top' || 
                text.toLowerCase() === '.top' || 
                text.toLowerCase() === '!leaderboard'
            ) {
                const sortedUsers = Object.keys(userDB).map(jid => {
                    return { jid, ...userDB[jid] };
                }).sort((a, b) => {
                    if (b.level === a.level) {
                        return b.xp - a.xp;
                    }
                    return b.level - a.level;
                });

                const top5 = sortedUsers.slice(0, 5);
                
                if (top5.length === 0) {
                    await sock.sendMessage(from, { text: '❌ Belum ada data level di grup ini.' }, { quoted: msg });
                    return;
                }

                let textLeaderboard = `🏆 *TOP 5 LEADERBOARD LEVEL GRUP* 🏆\n\n`;
                const mentionsList = [];

                top5.forEach((user, index) => {
                    const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
                    const tagNumber = user.jid.split('@')[0];
                    textLeaderboard += `${rankEmoji} *@${tagNumber}*\n    └ 🏅 Level: *${user.level}* | ⚡ XP: *${user.xp}*\n\n`;
                    mentionsList.push(user.jid);
                });

                await sock.sendMessage(from, { 
                    text: textLeaderboard, 
                    mentions: mentionsList 
                }, { quoted: msg });
                
                return;
            }

            // C. PROSES DOWNLOADER TIKTOK (+25 XP BONUS)
            if (cleanUrl && cleanUrl.includes('tiktok.com')) {
                await sock.sendMessage(from, { text: '⏳ *[TikTok Downloader]*\nSedang mengunduh media...' }, { quoted: msg });
                const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                const json = await res.json();

                if (json.data) {
                    if (json.data.play) {
                        await sock.sendMessage(from, {
                            video: { url: json.data.play },
                            caption: `✅ *${json.data.title || 'TikTok Video'}*`
                        }, { quoted: msg });
                    } else if (json.data.images && json.data.images.length > 0) {
                        for (const imgUrl of json.data.images) {
                            await sock.sendMessage(from, { image: { url: imgUrl } }, { quoted: msg });
                        }
                    }
                    await tambahXP(sock, from, userJid, 25, msg);
                } else {
                    await sock.sendMessage(from, { text: '❌ Gagal mengunduh media TikTok.' }, { quoted: msg });
                }
                return;
            }

            // D. PROSES DOWNLOADER MULTI-PLATFORM VIA COBALT API (+25 XP BONUS)
            else if (
                cleanUrl && (
                    cleanUrl.includes('instagram.com') || 
                    cleanUrl.includes('youtube.com') || 
                    cleanUrl.includes('youtu.be') ||
                    cleanUrl.includes('facebook.com') ||
                    cleanUrl.includes('pin.it') ||
                    cleanUrl.includes('pinterest.com')
                )
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
                    if (data.url) {
                        const isImage = data.url.includes('.jpg') || data.url.includes('.png') || data.url.includes('.webp');
                        if (isImage) {
                            await sock.sendMessage(from, { image: { url: data.url }, caption: '✅ Foto berhasil diunduh!' }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { video: { url: data.url }, caption: '✅ Video berhasil diunduh!' }, { quoted: msg });
                        }
                    } else if (data.picker && data.picker.length > 0) {
                        for (const item of data.picker) {
                            if (item.type === 'photo') {
                                await sock.sendMessage(from, { image: { url: item.url } }, { quoted: msg });
                            } else if (item.type === 'video') {
                                await sock.sendMessage(from, { video: { url: item.url } }, { quoted: msg });
                            }
                        }
                    } else {
                        await sock.sendMessage(from, { text: '❌ Gagal mengambil media dari link tersebut.' }, { quoted: msg });
                        return;
                    }
                    await tambahXP(sock, from, userJid, 25, msg);
                }
                return;
            }

            // =========================================================================
            // ⏳ E. FILTER 2: COOLDOWN 3 DETIK UNTUK PENAMBAHAN XP CHAT BIASA (+10 XP)
            // =========================================================================
            const now = Date.now();
            const cooldownTime = 3000; // 3000 milidetik = 3 detik

            if (cooldownXP[userJid]) {
                const selisihWaktu = now - cooldownXP[userJid];
                if (selisihWaktu < cooldownTime) {
                    // Jika belum lewat 3 detik sejak chat terakhir, jangan tambahkan XP
                    return;
                }
            }

            // Perbarui waktu chat terakhir user ini
            cooldownXP[userJid] = now;

            // Tambahkan XP karena sudah melewati jeda 3 detik
            await tambahXP(sock, from, userJid, 10, msg);

        } catch (err) {
            console.error('Error Bot Process:', err);
        }
    });
}

startBot();