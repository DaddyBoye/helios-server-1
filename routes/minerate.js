const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Route to fetch a specific user's minerate by telegramId
router.get('/users/minerate/:telegramId', async (req, res) => {
    const { telegramId } = req.params; // Extract telegramId from route parameters

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('minerate')
            .eq('telegramId', telegramId)
            .single(); // Fetch a single user

        if (error || !user) {
            console.error('Error fetching user minerate:', error);
            return res.status(404).json({ error: 'User not found' });
        }

        // Return only the minerate
        return res.json({ minerate: user.minerate });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// Route to increase minerate for a user
router.patch('/users/increase-minerate/:telegramId/:amount', async (req, res) => {
    const { telegramId, amount } = req.params;

    // Validate input
    const incrementAmount = parseInt(amount, 10);
    if (isNaN(incrementAmount) || incrementAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        // Fetch the current minerate
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('minerate')
            .eq('telegramId', telegramId)
            .single();

        if (fetchError || !user) {
            console.error('Error fetching user minerate:', fetchError);
            return res.status(404).json({ error: 'User not found' });
        }

        // Increment the minerate
        const newMinerate = user.minerate + incrementAmount;

        // Update the minerate in the database
        const { error: updateError } = await supabase
            .from('users')
            .update({ minerate: newMinerate })
            .eq('telegramId', telegramId);

        if (updateError) {
            console.error('Error updating minerate:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.status(200).json({ message: 'Minerate updated successfully', minerate: newMinerate });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

module.exports = router;
