const NodeMediaServer = require('./');
const isEmpty = require('lodash/isEmpty')
const http = require('./http-client')
const createPlaylist = require('./create-playlist')

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: false,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: process.env.MEDIA_ROOT || './media',
    webroot: './www',
    allow_origin: '*',
    api: true
  },
  https: {
    port: 8443,
    key: './privatekey.pem',
    cert: './certificate.pem',
  },
  relay: {
    ffmpeg: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'stream',
        mode: 'push',
        edge: 'rtmp://127.0.0.1/hls_1080p',
      },
      {
        app: 'stream',
        mode: 'push',
        edge: 'rtmp://127.0.0.1/hls_720p',
      },
      {
        app: 'stream',
        mode: 'push',
        edge: 'rtmp://127.0.0.1/hls_480p',
      },
      {
        app: 'stream',
        mode: 'push',
        edge: 'rtmp://127.0.0.1/hls_360p',
      },
    ],
  },
  // hls_list_size=0 => keep all segment
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'hls_1080p',
        hls: true,
        ac: 'aac',
        acParam: ['-b:a', '192k', '-ar', 48000],
        vcParams: [
          '-vf',
          "'scale=1920:-1'",
          '-b:v',
          '5000k',
          '-preset',
          'fast',
          '-profile:v',
          'baseline',
          '-bufsize',
          '7500k'
        ],
        hlsFlags: '[hls_time=10:hls_list_size=3:hls_flags=delete_segments]',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      },
      {
        app: 'hls_720p',
        hls: true,
        ac: 'aac',
        acParam: ['-b:a', '128k', '-ar', 48000],
        vcParams: [
          '-vf',
          "'scale=1280:-1'",
          '-b:v',
          '2800k',
          '-preset',
          'fast',
          '-profile:v',
          'baseline',
          '-bufsize',
          '4200k'
        ],
        hlsFlags: '[hls_time=10:hls_list_size=3:hls_flags=delete_segments]',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      },
      {
        app: 'hls_480p',
        hls: true,
        ac: 'aac',
        acParam: ['-b:a', '128k', '-ar', 48000],
        vcParams: [
          '-vf',
          "'scale=854:-1'",
          '-b:v',
          '1400k',
          '-preset',
          'fast',
          '-profile:v',
          'baseline',
          '-bufsize',
          '2100k'
        ],
        hlsFlags: '[hls_time=10:hls_list_size=3:hls_flags=delete_segments]',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      },
      {
        app: 'hls_360p',
        hls: true,
        ac: 'aac',
        acParam: ['-b:a', '96k', '-ar', 48000],
        vcParams: [
          '-vf',
          "'scale=480:-1'",
          '-b:v',
          '800k',
          '-preset',
          'fast',
          '-profile:v',
          'baseline',
          '-bufsize',
          '1200k'
        ],
        hlsFlags: '[hls_time=10:hls_list_size=3:hls_flags=delete_segments]',
        mp4: true,
        mp4Flags: '[movflags=faststart]',
      },
    ],
  },
  // trans: {
  //   ffmpeg: '/usr/bin/ffmpeg',
  //   tasks: [
  //     {
  //       app: 'live',
  //       hls: true,
  //       hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
  //       dash: true,
  //       dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
  //       mp4: true,
  //       mp4Flags: '[movflags=faststart]',
  //     }
  //   ]
  // },

  // auth: {
  //   api: true,
  //   api_user: 'admin',
  //   api_pass: 'admin',
  //   play: false,
  //   publish: false,
  //   secret: 'nodemedia2017privatekey'
  // },
};


let nms = new NodeMediaServer(config)

var tokens = {}

const parseStreamName = streamPath => {
  return streamPath
    .replace('/hls_1080', '')
    .replace('/hls_720p', '')
    .replace('/hls_480p/', '')
    .replace('/hls_360p/', '')
    .replace('/stream/', '')
}

nms.on('prePublish', async (id, StreamPath, args) => {
  const streamName = parseStreamName(StreamPath)
  console.log(`${streamName} has started streaming`)
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  if (args.streamKey && args.streamToken) {
    tokens[streamName] = {
      app: 'stream',
      streamKey: args.streamKey,
      streamToken: args.streamToken,
    }
  }

  if (tokens[streamName]) {
    let session = nms.getSession(id)
    if (!isEmpty(process.env.PUBLISH_START_NOTIFY_URL)) {
      await http
        .post(process.env.PUBLISH_START_NOTIFY_URL, tokens[streamName])
        .catch(err => {
          console.error(err.message)
          session.reject()
        })
    }
  }
})

nms.on('postPublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  if (StreamPath.indexOf('hls_') !== -1) {
    const name = StreamPath.split('/').pop()
    createPlaylist(name)
  }
})

nms.on('donePublish', async (id, StreamPath, args) => {
  const streamName = parseStreamName(StreamPath)
  console.log(`${streamName} has stopped streaming...`)
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  if (tokens[streamName]) {
    let session = nms.getSession(id)
    if (!isEmpty(process.env.PUBLISH_STOP_NOTIFY_URL)) {
      await http
        .post(process.env.PUBLISH_STOP_NOTIFY_URL, tokens[streamName])
        .catch(err => {
          console.error(err.message)
          session.reject()
        })
    }
  }
})

nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

// nms.on('prePublish', (id, StreamPath, args) => {
//   console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
//   // let session = nms.getSession(id);
//   // session.reject();
// });

// nms.on('postPublish', (id, StreamPath, args) => {
//   console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
// });

// nms.on('donePublish', (id, StreamPath, args) => {
//   console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
// });

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

