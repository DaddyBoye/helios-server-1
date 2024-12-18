const express = require('express');
const crypto = require('crypto');
const router = express.Router();
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be provided.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to generate a unique referral token
const generateReferralToken = (telegramId) => {
    const telegramIdString = String(telegramId);
    const randomPart = crypto.randomBytes(4).toString('hex'); // Generates a 4-byte random value
    const referralToken = `${telegramIdString}-${randomPart}`;
    return referralToken;
};

// Update the referral token for a user
router.post('/referral/token/:telegramId', async (req, res) => {
    const { telegramId } = req.params;
    const { referralToken } = req.body;

    try {
        const { data, error } = await supabase
            .from('users')
            .update({ referralToken })
            .eq('telegramId', telegramId);

        if (error) {
            console.error('Error updating referral token:', error);
            return res.status(500).json({ message: 'Error updating referral token' });
        }

        res.status(200).json({ message: 'Referral token updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Generate and create a referral token for a new user
router.post('/referral/token/create/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    // Generate a referral token
    const referralToken = generateReferralToken(telegramId);

    try {
        const { data, error } = await supabase
            .from('users')
            .update({ referralToken })
            .eq('telegramId', telegramId);

        if (error) {
            console.error('Error creating referral token:', error);
            return res.status(500).json({ message: 'Error creating referral token' });
        }

        res.status(200).json({ message: 'Referral token created successfully', referralToken });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/referral/users/:telegramId', async (req, res) => {
    const { telegramId } = req.params; // No need for a request body in GET

    try {
        const { data: referrals, error } = await supabase
        .from('referrals')
        .select(`
            referredUserTelegramId,
            timestamp,
            users!fk_referred_user(telegramUsername, totalAirdrops, referralCount, heliosUsername, avatarPath)
        `)
        .eq('referrerTelegramId', telegramId);
    

        if (error) {
            console.error('Error fetching referrals:', error);
            return res.status(500).json({ message: 'Error fetching referrals' });
        }

        const { count: referralCount, error: countError } = await supabase
            .from('referrals')
            .select('*', { count: 'exact' })
            .eq('referrerTelegramId', telegramId);

        if (countError) {
            console.error('Error fetching referral count:', countError);
            return res.status(500).json({ message: 'Error fetching referral count' });
        }

        res.status(200).json({
            referralCount,
            referrals
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get the user who referred the current user
router.get('/referral/referrer/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('referredBy')
            .eq('telegramId', telegramId)
            .single();

        if (error) {
            console.error('Error fetching referrer:', error);
            return res.status(500).json({ message: 'Error fetching referrer' });
        }

        if (!user.referredBy) {
            return res.status(404).json({ message: 'No referrer found for this user' });
        }

        const { data: referrer, error: referrerError } = await supabase
            .from('users')
            .select('telegramId, telegramUsername')
            .eq('telegramId', user.referredBy)
            .single();

        if (referrerError) {
            console.error('Error fetching referrer details:', referrerError);
            return res.status(500).json({ message: 'Error fetching referrer details' });
        }

        res.status(200).json({ referrer });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
