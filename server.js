const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const firebaseConfig = require('./firebaseConfig')
const db = firebaseConfig.db;
const {collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, getFirestore, orderBy, Timestamp}= require('firebase/firestore');
const e = require('express');
// const NodeCache = require('node-cache');
// const cache = new NodeCache({ stdTTL: 60 });

const app = express();
const port = 5000;

// Replace with your actual YouTube API key
const YOUTUBE_API_KEY = 'AIzaSyAZwzHCOwjwMgZYcpaQMGhkFJ5ShNtQ3EU';

// store JWT_SECRET 
const JWT_SECRET = '9003TRK';

// app.use(cors({
//   origin: ['http://localhost:3000', 'https://trk-murex.vercel.app'],
//   //credentials: true,
// }));

// app.use(cors({
//   origin: ['http://localhost:3000', 'https://trk-murex.vercel.app'],
//   allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
//   methods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
//   credentials: true,
// }));

const corsOptions = {
  origin: ['https://trk-murex.vercel.app'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
  methods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// server handling preflight requests

app.use(express.json());

// User registration route
app.post('/api/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password, phone_number } = req.body;

  try {
    const usersCollectionRef = collection(db, 'users');
    const userRef = doc(usersCollectionRef, email);
    const doc = await userRef.get();

    if (doc.exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await setDoc(userRef, {
      name,
      email,
      password: hashedPassword,
      phone_number
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// User login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const usersCollectionRef = collection(db, 'users');
    const userRef = doc(usersCollectionRef, email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = doc.data();
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to authenticate user
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) return res.sendStatus(401);

//   jwt.verify(token, JWT_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403);
//     req.user = user;
//     next();
//   });
// };

// Fetch User Info
app.get('/api/user-info', async (req, res) => {
  try {
    const usersCollectionRef = collection(db, 'users');
    const userRef = doc(usersCollectionRef, req.user.email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = doc.data();
    res.json({ name: user.name, email: user.email, phone_number: user.phone_number || "" });
  } catch (err) {
    console.error('Error fetching user info:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Fetch users from Firebase Firestore
app.get("/api/users", async (req, res) => {
  try {
    const usersCollectionRef = collection(db, ' users');
    const usersSnapshot = await getDocs(usersCollectionRef);

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'No users found' });
    }

    const users = usersSnapshot.docs.map(doc => doc.data());
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Helper function to extract social media links from a YouTube video description
function extractSocialMediaLinks(description) {
  console.log('Description:', description);
  const socialLinks = {};

  const facebookRegex = /https?:\/\/(?:www\.)?facebook\.com\/[^\s/]+/i;
  const twitterRegex = /https?:\/\/(?:www\.)?twitter\.com\/[^\s/]+/i;
  const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/[^\s/]+/i;

  // Match and extract social media URLs
  const facebookMatch = description.match(facebookRegex);
  const twitterMatch = description.match(twitterRegex);
  const instagramMatch = description.match(instagramRegex);

  if (facebookMatch) {
    socialLinks.facebook = facebookMatch[0];
  }
  if (twitterMatch) {
    socialLinks.twitter = twitterMatch[0];
  }
  if (instagramMatch) {
    socialLinks.instagram = instagramMatch[0];
  }

  return socialLinks;
}

function extractLyrics(description) {
  const lyricsMatch = description.match(/(?<=Lyrics:)[\s\S]*?(?=\n\n|$)/i);
  return lyricsMatch ? lyricsMatch[0].trim() : null;
}

//original
// function extractVideoId(url) {
//   const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
//   const match = url.match(regex);
//   return match ? match[1] : null;
// }

//copy

function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}



// Post operation to create songs
// app.post('/api/songs', async (req, res) => {
//   const { songUrl, genre, subGenre, mood, city, state } = req.body;

//   const videoId = extractVideoId(songUrl);
//   if (!videoId) {
//     return res.status(400).json({ error: 'Invalid YouTube URL' });
//   }

//   try {
//     const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
//       params: {
//         part: 'snippet',
//         id: videoId,
//         key: YOUTUBE_API_KEY
//       }
//     });

//     if (response.data.items.length === 0) {
//       return res.status(404).json({ error: 'Video not found' });
//     }

//     const videoDetails = response.data.items[0].snippet;
//     const artistName = videoDetails.channelTitle;
//     const songName = videoDetails.title;
//     const thumbnailUrl = videoDetails.thumbnails.high.url;
//     const socialLinks = extractSocialMediaLinks(videoDetails.description);
//     const lyrics = extractLyrics(videoDetails.description);

//     const songRef = doc(collection(db, 'songs'));
//     await setDoc(songRef, {
//       artist_name: artistName,
//       song_name: songName,
//       song_url: songUrl,
//       genre,
//       sub_genre: subGenre,
//       mood,
//       city,
//       state,
//       thumbnail_url: thumbnailUrl,
//       facebook_url: socialLinks.facebook || null,
//       twitter_url: socialLinks.twitter || null,
//       instagram_url: socialLinks.instagram || null,
//       lyrics: lyrics || null
//     });

//     res.status(201).json({ message: 'Song added successfully!' });
//   } catch (err) {
//     console.error('Failed to fetch video details:', err);
//     res.status(500).json({ error: 'Failed to fetch video details: ' + err.message });
//   }
// });


app.post('/api/songs', async (req, res) => {

  const {
    artist_name,
    city,
    state,
    songUrl,
    genre,
    subgenre,
    mood,
    spotify_url,
    itunes_url,
    soundcloud_url,
    apple_url,
    pandora_url,
    facebook,
    twitter,
    instagram,
  } = req.body;

  const videoId = extractVideoId(songUrl);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    });

    if (response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoDetails = response.data.items[0].snippet;
    const songName = videoDetails.title;
    const thumbnailUrl = videoDetails.thumbnails.high.url;

    const songRef = doc(collection(db, 'songs'));
    await setDoc(songRef, {
      artist_name,
    song_name: songName,
    song_url: songUrl,
    genre: genre || '',
    sub_genre: subgenre || '',
    mood: mood || '',
    city: city || '',
    state: state || '',
    thumbnail_url: thumbnailUrl,
    facebook_url: facebook || '',
    twitter_url: twitter || '',
    instagram_url: instagram || '',
    spotify_url: spotify_url || '',
    itunes_url: itunes_url || '',
    soundcloud_url: soundcloud_url || '',
    apple_url: apple_url || '',
    pandora_url: pandora_url || '',
    });

    res.status(201).json({ message: 'Song added successfully!' });
  } catch (err) {
    console.error('Failed to fetch video details:', err);
    res.status(500).json({ error: 'Failed to fetch video details: ' + err.message });
  }
});

// Get operation to retrieve all songs
// Get operation to retrieve all songs
app.get('/api/songs', async (req, res) => {
  try {
    const songsCollectionRef = collection(db, 'songs');
    const songsSnapshot = await getDocs(songsCollectionRef);
    const songsList = songsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(songsList);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).send('Internal Server Error');
  }
});



app.get('/api/reviews/:songId', async (req, res) => {
  const { songId } = req.params;
  try {
    const reviewsCollectionRef = collection(db, 'reviews');
    const q = query(reviewsCollectionRef, where('songId', '==', songId));
    const reviewsSnapshot = await getDocs(q);
    const reviewsList = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(reviewsList);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).send('Internal Server Error');
  }
});


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// Submit a review with batch write
app.post('/api/reviews', async (req, res) => {
  const {songId, review, rating} = req.body;
  const userId = req.user.uid;
  const userName = req.user.displayName;

  try {
    const batch = writeBatch(db);
    const reviewRef = doc(collection(db, 'reviews'));
    batch.set(reviewRef, {
      songId,
      userId,
      userName,
      review,
      rating,
      timestamp: new Date(),
    });

    await batch.commit();

    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Error submitting review' });
  }
})



// receive the url from oracle
//  endpoint created here
// POST endpoint to process YouTube URL
app.post('/api/review-url', async (req, res) => {
  const { url } = req.body;
  const videoId = extractVideoId(url);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet',
        id: videoId,
        key: YOUTUBE_API_KEY,
      },
    });

    if (response.data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoDetails = response.data.items[0].snippet;
    
    const formData = {
      apple_url: '', // Not available via YouTube API
      artist_name: videoDetails.channelTitle || 'N/A',
      city: '', // Not available via YouTube API
      facebook_url: '', // Not available via YouTube API
      genre: '', // Not available via YouTube API
      instagram_url: '', // Not available via YouTube API
      itunes_url: '', // Not available via YouTube API
      mood: '', // Not available via YouTube API
      pandora_url: '', // Not available via YouTube API
      song_name: videoDetails.title || 'N/A',
      song_url: url,
      soundcloud_url: '', // Not available via YouTube API
      spotify_url: '', // Not available via YouTube API
      state: '', // Not available via YouTube API
      sub_genre: '', // Not available via YouTube API
      thumbnail_url: videoDetails.thumbnails?.high?.url || '', // Handle cases where thumbnail may not be available
      twitter_url: '', // Not available via YouTube API
      createdAt: Timestamp.fromDate(new Date()), // Add timestamp
    };

    const db = getFirestore();
    const processedCollectionRef = collection(db, 'processed');
    const docRef = doc(processedCollectionRef); // Create a new document reference
    await setDoc(docRef, formData); // Add the data to the document


    res.json({ message: 'URL processed successfully' });
  } catch (err) {
    console.error('Failed to fetch video details:', err);
    res.status(500).json({ error: "Failed to fetch video details: " + err.message });
  }
});


//  endpoint created here

// GET endpoint to retrieve the latest processed data
app.get('/api/review-url', async (req, res) => {
  try {
    const db = getFirestore();
    const processedCollectionRef = collection(db, 'processed');
    const q = query(processedCollectionRef, orderBy('createdAt', 'desc')); // Retrieve the latest document
    const processedSnapshot = await getDocs(q);

    if (processedSnapshot.empty) {
      return res.status(404).json({ error: 'No data found' });
    }

    const formData = processedSnapshot.docs[0].data(); // Retrieve the data from the latest document
    res.json(formData);
  } catch (err) {
    console.error('Failed to retrieve formData:', err);
    res.status(500).json({ error: "Failed to retrieve formData: " + err.message });
  }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Rate limiting middleware
// const rateLimit = (req, res, next) => {
//   const ip = req.ip;
//   const rateLimitKey = `rateLimit_${ip}`;
//   const currentTime = Date.now();
//   const rateLimitWindow = 60000; // 1 minute
//   const maxRequests = 10;

//   const requestTimes = cache.get(rateLimitKey) || [];
//   const filteredRequestTimes = requestTimes.filter(time => currentTime - time < rateLimitWindow);
//   if (filteredRequestTimes.length >= maxRequests) {
//     return res.status(429).json({ error: 'Too many requests, please try again later' });
//   }

//   filteredRequestTimes.push(currentTime);
//   cache.set(rateLimitKey, filteredRequestTimes);

//   next();
// };

// app.use(rateLimit);



// Route to retrieve a specific song by ID
app.get('/api/songs/:id', async (req, res) => {
  const songId = req.params.id;

  try {
    const songRef = doc(db, 'songs', songId);
    const doc = await getDoc(songRef);

    if (!doc.exists) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.status(200).json(doc.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});