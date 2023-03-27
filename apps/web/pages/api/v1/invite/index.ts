import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyInviteToken } from '@/lib/jwt';

export default async function verify(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed' });
        return;
    }

    const token = req.query.token;

    if (!token || Array.isArray(token)) {
        res.status(400).json({ message: 'Invalid token' });
        return;
    }

    try {
        const decoded = await verifyInviteToken(token);

        // Redirect to the appropriate page based on the decoded token
        // You may need to adjust the path based on your project structure
        res.redirect(`/invite?teamId=${decoded.teamId}&email=${decoded.email}`);
    } catch (error) {
        console.error('Error verifying invite token:', error.message);
        res.status(400).json({ message: 'Invalid or expired token' });
    }
}
