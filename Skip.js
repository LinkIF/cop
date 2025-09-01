// Plugin name: Skip Intro for Lampa
// Version: 1.0
// Description: Integrates with TMDB to get episode runtime and use fallback timestamps for skipping intro and ending.
// API Key: Provided by user (store securely in production)
// Note: This plugin assumes Lampa API for player events and video element. Adjust if needed based on Lampa documentation.
// For timestamps, uses fallback since TMDB doesn't provide exact segments.
// Alternatives: Comment on how to integrate Jellyfin or Credit Scout.

const TMDB_API_KEY = '4045c616742d57a88740bd49b7ed31d7';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Function to fetch episode details from TMDB
async function fetchEpisodeDetails(tmdbId, season, episode) {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching TMDB episode details:', error);
        return null;
    }
}

// Function to fetch timestamps (with fallback)
async function fetchEpisodeTimestamps(tmdbId, season, episode) {
    const episodeData = await fetchEpisodeDetails(tmdbId, season, episode);
    
    if (episodeData) {
        const runtimeSeconds = episodeData.runtime * 60 || 2700; // Default 45 min if runtime missing
        
        // Fallback values: intro 0-90 sec, ending last 10%
        const introStart = 0;
        const introEnd = 90;
        const endingStart = Math.floor(runtimeSeconds * 0.9);
        const endingEnd = runtimeSeconds;
        
        return {
            introStart,
            introEnd,
            endingStart,
            endingEnd
        };
    } else {
        // Default fallback if API fails
        return {
            introStart: 0,
            introEnd: 90,
            endingStart: 2400, // For ~40 min episode
            endingEnd: 2700
        };
    }
}

// Mock data for testing (optional, uncomment to use)
/*
const mockData = {
    '1399-1-1': { introStart: 0, introEnd: 85, endingStart: 3300, endingEnd: 3720 }, // Example for Game of Thrones S1E1
    // Add more as needed
};

async function fetchEpisodeTimestamps(tmdbId, season, episode) {
    const key = `${tmdbId}-${season}-${episode}`;
    return mockData[key] || { introStart: 0, introEnd: 90, endingStart: 2400, endingEnd: 2700 };
}
*/

// Plugin initialization
function initPlugin() {
    // Listen for player ready event (based on Lampa API patterns from examples)
    Lampa.Listener.follow('player', function(e) {
        if (e.type === 'ready' || e.type === 'start') { // Adjust event type if needed (e.g., 'ready', 'play')
            // Get current movie/episode data (adjust based on Lampa structure)
            // Assumption: Current item is accessible via Lampa.Player.item or Lampa.Activity.active().data
            // You may need to inspect Lampa source or console.log(Lampa) to find exact path
            var currentItem = Lampa.Player.item || Lampa.Activity.active().activity.component.item || {}; 
            var tmdbId = currentItem.tmdb_id || currentItem.id; // TMDB ID of the TV show
            var season = currentItem.season || 1;
            var episode = currentItem.episode || 1;

            if (tmdbId && season && episode) {
                fetchEpisodeTimestamps(tmdbId, season, episode).then(timestamps => {
                    console.log('SkipIntro: Timestamps loaded', timestamps);

                    // Get video element
                    var video = document.getElementsByTagName('video')[0];
                    if (!video) return;

                    // Add timeupdate listener for skipping
                    var introSkipped = false;
                    var endingSkipped = false;

                    video.addEventListener('timeupdate', function() {
                        var currentTime = video.currentTime;

                        // Skip intro if in range and not skipped yet
                        if (!introSkipped && currentTime > timestamps.introStart && currentTime < timestamps.introEnd) {
                            video.currentTime = timestamps.introEnd;
                            introSkipped = true;
                            console.log('SkipIntro: Skipped intro');
                        }

                        // Skip ending (credits) if in range and not skipped yet
                        if (!endingSkipped && currentTime > timestamps.endingStart && currentTime < timestamps.endingEnd) {
                            // For ending, perhaps seek to end or next episode, but here seek to end
                            video.currentTime = timestamps.endingEnd;
                            endingSkipped = true;
                            console.log('SkipIntro: Skipped ending');
                        }
                    });
                }).catch(error => {
                    console.error('SkipIntro: Error loading timestamps', error);
                });
            } else {
                console.warn('SkipIntro: Missing episode data (tmdbId, season, episode)');
            }
        }
    });

    console.log('SkipIntro Plugin initialized');
}

// Register or run the plugin
// Based on Lampa patterns, plugins often run init directly or add to Lampa.Plugin
if (typeof Lampa.Plugin !== 'undefined') {
    Lampa.Plugin.add({
        name: 'SkipIntro',
        version: '1.0',
        init: initPlugin
    });
} else {
    // Fallback: Run init directly
    initPlugin();
}

// Alternatives integration notes:
// For Jellyfin Intro Skipper: If you have a Jellyfin server, replace fetchEpisodeTimestamps with a fetch to your Jellyfin API.
// Example:
/*
async function fetchFromJellyfin(itemId) {
    const url = 'http://your-jellyfin-server/Items/' + itemId + '/MediaSegments?api_key=YOUR_JF_KEY';
    const response = await fetch(url);
    const data = await response.json();
    // Parse segments for intro/ending
    let intro = data.Segments.find(s => s.Type === 'Intro') || {Start: 0, End: 90000}; // ms
    let ending = data.Segments.find(s => s.Type === 'Credits') || {Start: runtimeSeconds * 900, End: runtimeSeconds * 1000};
    return {
        introStart: intro.Start / 1000,
        introEnd: intro.End / 1000,
        endingStart: ending.Start / 1000,
        endingEnd: ending.End / 1000
    };
}
*/
// Similar for Credit Scout: Set up a server and fetch from it.

})();
