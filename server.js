const express = require("express");
const app = express();
app.use(express.json());

const { StreamClient } = require("@stream-io/node-sdk");

const apiKey = "k532vzf4a7cx";
const secret = "nepaw7eakf3ddb87v6xbezs9dtaq8rjaxwhsypjwb6ewmvd6apb9mfmczpwy3rrm";

const client = new StreamClient(apiKey, secret);

const fetchStreamToken = async (userId) => {
    const response = await fetch(
        "https://pronto.getstream.io/api/auth/create-token?" +
        new URLSearchParams({
            api_key: apiKey,
            user_id: userId,
        })
    );

    const data = await response.json();
    return data.token;
};

app.post("/initialize-stream", async (req, res) => {
    try {
        const { userId, callId } = req.body;
        if (!userId || !callId) {
            return res.status(400).json({ error: "User ID and Call ID are required" });
        }

        const newUser = {
            id: userId,
            role: "admin",
            custom: { color: "red" },
            name: "John",
        };
        await client.upsertUsers([newUser]);

        const token = await fetchStreamToken(userId);

        const callType = "default";
        const call = client.video.call(callType, callId);
        await call.create({
            data: {
                created_by_id: userId,
                members: [{ user_id: userId, role: "admin" }],
                custom: { color: "blue" },
            },
        });

        res.json({ token, callId, callType });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to initialize stream" });
    }
});

const PORT = 3333;
app.listen(PORT, () => {
    console.log(`⁠Server running on port ${PORT}`);
});