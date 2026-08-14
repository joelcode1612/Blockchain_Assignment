const supabase = require('../config/supabase');

exports.verifyMilestone = async (req, res) => {
    try {
        const { agreementId, milestoneId } = req.params;
        const shipperAddress = req.user.wallet_address;

        // Find agreement by onchain_id
        const { data: agreement } = await supabase
            .from('agreements')
            .select('*')
            .eq('onchain_id', parseInt(agreementId))
            .single();

        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

        // Find milestone by order (or by some identifier) – we use "order"
        const { data: milestone } = await supabase
            .from('milestones')
            .select('*')
            .eq('agreement_id', agreement.id)
            .eq('order', parseInt(milestoneId))
            .single();

        if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

        // Update verified status
        await supabase
            .from('milestones')
            .update({ verified: true, verified_at: new Date().toISOString() })
            .eq('id', milestone.id);

        res.status(200).json({ message: 'Milestone verified successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};