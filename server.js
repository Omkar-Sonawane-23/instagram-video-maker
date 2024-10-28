const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const app = express();
const PORT = 3000;

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Endpoint to merge video and audio with text overlay
app.post('/merge', upload.fields([{ name: 'video' }, { name: 'audio' }]), (req, res) => {
    const videoPath = path.join(__dirname, 'uploads', req.files['video'][0].filename);
    const audioPath = path.join(__dirname, 'uploads', req.files['audio'][0].filename);
    const text = req.body.text;
    const outputPath = path.join(__dirname, 'uploads', 'merged_video.mp4');

    // FFmpeg command to merge video and audio and overlay text
    ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-c:a', 'aac')
        .outputOptions('-vf', `drawtext=text='${text}':x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=white:fontsize=24`)
        .on('end', () => {
            console.log('Processing finished successfully.');
            res.download(outputPath, (err) => {
                if (err) {
                    console.error('Download error: ', err);
                }
            });
        })
        .on('error', (err) => {
            console.error('Error during processing: ', err);
            res.status(500).send('Error processing files.');
        })
        .save(outputPath);
});

// Serve the HTML page
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

