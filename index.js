// This is a conceptual example. You would need to set up a Node.js environment
// with Express and the 'axios' or 'node-fetch' library.
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const port = 3000;
app.use(cors());

// You MUST store your JWT in environment variables for security.
// DO NOT hard-code them.
const PINATA_JWT = process.env.PINATA_JWT;

// In a real-world application, this would be a database like Redis or Firestore
// to ensure keys persist and are secure across server restarts.
const validOrderKeys = new Set();

app.use(express.json());

// Endpoint to generate a new, unique order key for a client.
app.post('/api/generate-order-key', async (req, res) => {
    try {
        const uniqueKey = crypto.randomBytes(16).toString('hex');
        validOrderKeys.add(uniqueKey);
        console.log(`Generated new order key: ${uniqueKey}`); // Debug log
        res.json({ orderKey: uniqueKey });
    } catch (error) {
        console.error('Error generating order key:', error);
        res.status(500).json({ error: 'Failed to generate order key.' });
    }
});

// This is the SECURED API endpoint the frontend will call.
app.post('/api/upload-order', async (req, res) => {
    const { orderKey, ...orderData } = req.body;

    // 1. Check if the key exists and is valid.
    if (!orderKey || !validOrderKeys.has(orderKey)) {
        console.error('Invalid or missing order key:', orderKey); // Debug log
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing order key.' });
    }

    // 2. Invalidate the key immediately to prevent reuse.
    validOrderKeys.delete(orderKey);

    if (!PINATA_JWT) {
        return res.status(500).json({ error: 'Pinata JWT is not configured.' });
    }
    
    try {
        console.log('Attempting to upload to Pinata...'); // Debug log
        const pinataResponse = await axios.post(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            { pinataContent: orderData },
            {
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Successfully uploaded to Pinata.'); // Debug log
        // Send the IPFS hash back to the frontend
        res.json({ ipfsHash: pinataResponse.data.IpfsHash });

    } catch (error) {
        console.error('Error uploading to Pinata:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Pinata API responded with status:', error.response.status);
            console.error('Pinata API error data:', error.response.data);
            res.status(500).json({ error: 'Failed to upload order details to Pinata.', details: error.response.data });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from Pinata API:', error.message);
            res.status(500).json({ error: 'No response received from Pinata API. Check your network or the Pinata service status.' });
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error in Pinata request setup:', error.message);
            res.status(500).json({ error: 'Failed to upload order details.' });
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
