const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const botToken = process.env.BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: false });

// Set the airdrop limit
const AIRDROP_LIMIT = 8;

// Function to add airdrops for all users
const addAirdropsForAllUsers = async () => {
    try {
        // Fetch all users from the database
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('telegramId, heliosUsername, timezone, minerate, airdropClaimCount, totalAirdropCount, unclaimedAirdropTotal');

        if (userError) {
            console.error('User fetch error:', userError);
            throw new Error('Error fetching users from the database');
        }

        // Map through the users and add airdrops for each
        const airdropPromises = users.map(async (user) => {
            const { telegramId, heliosUsername, timezone, minerate, airdropClaimCount, totalAirdropCount, unclaimedAirdropTotal } = user;

            console.log(`User: ${heliosUsername}, Initial totalAirdropCount: ${totalAirdropCount}, Initial unclaimedAirdropTotal: ${unclaimedAirdropTotal}, Initial airdropClaimCount: ${airdropClaimCount}`);

            // Check if the user has reached the airdrop limit
            if (airdropClaimCount >= AIRDROP_LIMIT) {
                console.log(`User ${heliosUsername} with telegramId ${telegramId} has reached the airdrop limit.`);

                // Send the first message and initiate timed notifications
                await sendAirdropLimitNotifications(telegramId, heliosUsername, 0);

                return; // Skip this user if they reached the limit
            }

            // Calculate the local timestamp for the user
            const userLocalTime = new Date().toLocaleString('en-US', { timeZone: timezone });
            const timestamp = new Date(userLocalTime).toISOString();

            // Insert a new airdrop for the user
            const { error: insertError } = await supabase
                .from('airdrops')
                .insert([{ telegramId, value: minerate, heliosUsername, timestamp }]);

            if (insertError) {
                console.error(`Failed to insert airdrop for user ${heliosUsername}:`, insertError);
                throw new Error(`Error inserting airdrop for user: ${heliosUsername}`);
            }

            // Update totals and counts
            const newUnclaimedTotal = (unclaimedAirdropTotal || 0) + minerate;
            const newAirdropTotal = (totalAirdropCount || 0) + 1;
            const newAirdropClaimCount = airdropClaimCount + 1;

            console.log(`User: ${heliosUsername}, New totalAirdropCount: ${newAirdropTotal}, New unclaimedAirdropTotal: ${newUnclaimedTotal}, New airdropClaimCount: ${newAirdropClaimCount}`);

            // Send a notification if they just reached the limit
            if (newAirdropClaimCount === AIRDROP_LIMIT) {
                await sendAirdropLimitNotifications(telegramId, heliosUsername, 0);
            }

            // Update user records in the database
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    unclaimedAirdropTotal: newUnclaimedTotal,
                    totalAirdropCount: newAirdropTotal,
                    airdropClaimCount: newAirdropClaimCount,
                })
                .eq('telegramId', telegramId);

            if (updateError) {
                console.error(`Error updating user totals for ${heliosUsername}:`, updateError);
                throw new Error(`Error updating user totals for ${heliosUsername}`);
            }
        });

        await Promise.all(airdropPromises);

        console.log('Airdrops added for all users');
    } catch (error) {
        console.error('Error adding airdrops for all users:', error);
        throw new Error('Unable to add airdrops for all users');
    }
};

const sendAirdropLimitNotifications = async (telegramId, heliosUsername) => {
    try {
        // Fetch the user's last notification time from Supabase
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('lastNotificationTime, messageIndex') // Fetch the message index too
            .eq('telegramId', telegramId)
            .single();

        if (fetchError || !user) {
            console.error(`Failed to fetch user data for ${heliosUsername}:`, fetchError);
            return; // Skip notification if we can't fetch the user
        }

        const { lastNotificationTime, messageIndex = 0 } = user;

        // Check if 24 hours have passed since the last notification
        const now = new Date();
        const timeSinceLastNotification = lastNotificationTime
            ? now - new Date(lastNotificationTime)
            : Infinity;

        if (timeSinceLastNotification < 24 * 60 * 60 * 1000) {
            console.log(`Skipping notification for ${heliosUsername}. Last notification was sent less than 24 hours ago.`);
            return;
        }

        // Notification messages and buttons
        const messages = [
            {
                text: `🚨 Hey ${heliosUsername}, you’ve reached your airdrop limit! Claim your rewards now to continue earning. 🌟`,
                buttons: [
                    {
                        text: "🌟 Claim Offsets",
                        web_app: { url: "https://bamboo-1.vercel.app" },
                    },
                ],
            },
            {
                text: `💡 Reminder: ${heliosUsername}, you’re still at your airdrop limit. Claim to stand a chance of earning more offsets! 💎`,
                buttons: [
                    {
                        text: "🌟 Claim Offsets",
                        web_app: { url: "https://bamboo-1.vercel.app" },
                    },
                ],
            },
            {
                text: `🌍 Final Call: ${heliosUsername}, unlock new opportunities and contribute to environmental missions today! 🚀`,
                buttons: [
                    {
                        text: "🚀 Contribute Now",
                        web_app: { url: "https://bamboo-1.vercel.app" },
                    },
                ],
            },
        ];

        // Determine the current message to send
        const currentMessage = messages[messageIndex];

        if (!currentMessage) {
            console.log(`All notifications have been sent for ${heliosUsername}.`);
            return; // Stop if all messages have been sent
        }

        // Send the current message
        await bot.sendMessage(telegramId, currentMessage.text, {
            reply_markup: {
                inline_keyboard: currentMessage.buttons.map((button) => [button]),
            },
        });

        // Update the user's lastNotificationTime and increment messageIndex
        const { error: updateError } = await supabase
            .from('users')
            .update({
                lastNotificationTime: now.toISOString(), // Update timestamp
                messageIndex: messageIndex + 1, // Increment messageIndex
            })
            .eq('telegramId', telegramId);

        if (updateError) {
            console.error(`Failed to update notification state for ${heliosUsername}:`, updateError);
        } else {
            console.log(`Notification sent to ${heliosUsername} (Message ${messageIndex + 1}).`);
        }
    } catch (error) {
        if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 403) {
            console.warn(`Skipped user ${heliosUsername} (Telegram ID: ${telegramId}) as the bot is blocked.`);
        } else {
            console.error(`Failed to send notification to ${heliosUsername}:`, error);
        }
    }
};

module.exports = {
    addAirdropsForAllUsers,
};
