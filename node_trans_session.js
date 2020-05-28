//
//  Created by Mingliang Chen on 18/3/9.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const EventEmitter = require('events');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const fs = require('fs');

class NodeTransSession extends EventEmitter {
  constructor(conf) {
    super();
    this.conf = conf;
  }

  run() {
    let vc = this.conf.vc || 'copy';
    let ac = this.conf.ac || 'copy';
    let inPath = 'rtmp://127.0.0.1:' + this.conf.rtmpPort + this.conf.streamPath;
    let ouPath = `${this.conf.mediaroot}/${this.conf.streamApp}/${this.conf.streamName}`;
    let mapStr = '';
    let mp4FileName = ''

    if (this.conf.rtmp && this.conf.rtmpApp) {
      if (this.conf.rtmpApp === this.conf.streamApp) {
        Logger.error('[Transmuxing RTMP] Cannot output to the same app.');
      } else {
        let rtmpOutput = `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.rtmpApp}/${this.conf.streamName}`;
        mapStr += `[f=flv]${rtmpOutput}|`;
        Logger.log('[Transmuxing RTMP] ' + this.conf.streamPath + ' to ' + rtmpOutput);
      }
    }
    if (this.conf.mp4) {
      this.conf.mp4Flags = this.conf.mp4Flags ? this.conf.mp4Flags : '';
      mp4FileName = dateFormat('yyyy-mm-dd-HH-MM') + '.mp4';
      // let mapMp4 = `${this.conf.mp4Flags}${ouPath}/${mp4FileName}|`;
      // mapStr += mapMp4;
      Logger.log('[Transmuxing MP4] ' + this.conf.streamPath + ' to ' + ouPath + '/${resolution}/' + mp4FileName);
    }
    if (this.conf.hls) {
      this.conf.hlsFlags = this.conf.hlsFlags ? this.conf.hlsFlags : '';
      let hlsFileName = 'index.m3u8';
      let mapHls = `${this.conf.hlsFlags}${ouPath}/${hlsFileName}`;
      mapStr += mapHls;
      Logger.log('[Transmuxing HLS] ' + this.conf.streamPath + ' to ' + ouPath + '/' + hlsFileName);
    }
    if (this.conf.dash) {
      this.conf.dashFlags = this.conf.dashFlags ? this.conf.dashFlags : '';
      let dashFileName = 'index.mpd';
      let mapDash = `${this.conf.dashFlags}${ouPath}/${dashFileName}`;
      mapStr += mapDash;
      Logger.log('[Transmuxing DASH] ' + this.conf.streamPath + ' to ' + ouPath + '/' + dashFileName);
    }
    mkdirp.sync(ouPath);
    let argv = ['-y', '-fflags', 'nobuffer', '-i', inPath];
    Array.prototype.push.apply(argv, ['-s:v', '1280x720']);
    Array.prototype.push.apply(argv, ['-c:v', vc]);
    Array.prototype.push.apply(argv, this.conf.vcParam);
    Array.prototype.push.apply(argv, ['-c:a', ac]);
    Array.prototype.push.apply(argv, this.conf.acParam);
    Array.prototype.push.apply(argv, ['-f', 'tee', '-map', '0:a?', '-map', '0:v?', mapStr]);

    if (this.conf.mp4 && mp4FileName) {
      // 352 x 240 (240p) (SD)
      // 480 x 360 (360p)
      // 858 x 480 (480p)
      // 1280 x 720 (720p) (Half HD)
      // 1920 x 1080 (1080p) (Full HD)
      // 3860 x 2160 (2160p) (Ultra-HD) (4K)

      mkdirp.sync(`${ouPath}/720`);
      mkdirp.sync(`${ouPath}/480`);
      mkdirp.sync(`${ouPath}/360`);
      mkdirp.sync(`${ouPath}/240`);

      const outPath0 = `${ouPath}/720/${mp4FileName}`
      const outPath1 = `${ouPath}/480/${mp4FileName}`
      const outPath2 = `${ouPath}/360/${mp4FileName}`
      const outPath3 = `${ouPath}/240/${mp4FileName}`

      Array.prototype.push.apply(argv, ['-filter:v', 'scale=1280:720', '-max_muxing_queue_size', '9999', '-c:a', 'copy', outPath0]);
      Array.prototype.push.apply(argv, ['-filter:v', 'scale=858:480', '-max_muxing_queue_size', '9999', '-c:a', 'copy', outPath1]);
      Array.prototype.push.apply(argv, ['-filter:v',' scale=480:360', '-max_muxing_queue_size', '9999', '-c:a', 'copy', outPath2]);
      Array.prototype.push.apply(argv, ['-filter:v',' scale=352:240', '-max_muxing_queue_size', '9999', '-c:a', 'copy', outPath3]);
    }

    argv = argv.filter((n) => { return n }); //去空
    Logger.log([1])
    Logger.log(argv)
    Logger.log([2])
    this.ffmpeg_exec = spawn(this.conf.ffmpeg, argv);
    this.ffmpeg_exec.on('error', (e) => {
      Logger.ffdebug(e);
    });

    this.ffmpeg_exec.stdout.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.stderr.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.on('close', (code) => {
      Logger.log('[Transmuxing end] ' + this.conf.streamPath);
      this.emit('end');
      fs.readdir(ouPath, function (err, files) {
        if (!err) {
          files.forEach((filename) => {
            if (filename.endsWith('.ts')
              || filename.endsWith('.m3u8')
              || filename.endsWith('.mpd')
              || filename.endsWith('.m4s')
              || filename.endsWith('.tmp')) {
              fs.unlinkSync(ouPath + '/' + filename);
            }
          })
        }
      });
    });
  }

  end() {
    // this.ffmpeg_exec.kill();
  }
}

module.exports = NodeTransSession;
