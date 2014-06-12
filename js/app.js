



// tie player element name to the directive!

var player = angular.module('player', []);

var injectYtApiScript = function() {
  if (!window.ytApiInjected) {
    var tag = document.createElement('script');
    tag.src = "http://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    window.ytApiInjected = true;
  }
};

player.value('config', {
  el_name: 'player',
  width: '640',
  height: '390',
  playerVars: {
    controls: 0,
    iv_load_policy: 3,
    showinfo: 0
  }
});

player.factory('ytApi', ['config', function(config) {
  var srv = {};

  injectYtApiScript();

  var stateObserverCbs = [];
  var readyObserverCbs = [];
  var apiReadyObserverCbs = [];

  srv.STATE = {
    "UNSTARTED": -1,
    "ENDED": 0,
    "PLAYING": 1,
    "PAUSED": 2,
    "BUFFERING": 3,
    "VIDEO CUED": 5
  };

  srv.playerState = srv.STATE.UNSTARTED;
  srv.playerTime_sec = 0;
  srv.playerBuffer = 0;
  
  srv.regStateObserverCb = function(cb) {
    stateObserverCbs.push(cb);
  };

  srv.regReadyObserverCb = function(cb) {
    readyObserverCbs.push(cb);
  };

  srv.regApiReadyObserverCb = function(cb) {
    apiReadyObserverCbs.push(cb);
  };

  srv.notifyStateObservers = function( e ) {
    angular.forEach(stateObserverCbs, function(cb) {
      cb( e );
    });
  };

  srv.notifyReadyObservers = function( e ) {
    angular.forEach(readyObserverCbs, function(cb) {
      cb( e );
    });
  };

  srv.notifyApiReadyObservers = function() {
    angular.forEach(apiReadyObserverCbs, function(cb) {
      cb();
    });
  };

  srv.onStateChange = function( e ) {
    srv.playerState = e.data;
    srv.notifyStateObservers( e );
  };

  srv.onReady = function( e ) {
    srv.notifyReadyObservers( e );
  };

  srv.initPlayer = function() {
    return new YT.Player(config.el_name, {
      width: config.width,
      height: config.height,
      playerVars: config.playerVars,
      events: {
        'onReady': srv.onReady,
        'onStateChange': srv.onStateChange
      }
    });
  };

  // set window.onYouTubeIframeAPIReady to player service.onYouTubeIframeAPIReady
  srv.onYouTubeIframeAPIReady = function() {
    srv.player = srv.initPlayer();
  };

  srv.play = function(video) {
    srv.player.loadVideoById(video.id);
  };

  return srv;

}]);

var app = angular.module('qTube', ['player', 'ui.sortable']);

app.factory('objects', function() {
  var Video = function(id, author, title, thumb_url, desc, dur_s) {
    this.isIndex = false;
    this.id = id;
    this.author = author;
    this.title = title;
    this.thumb_url = thumb_url;
    this.desc = desc;
    this.dur_s = dur_s;
  };

  Video.prototype.toObj = function() {
    var property_obj = {
      'isIndex': this.isIndex,
      'id': this.id,
      'author': this.author,
      'title': this.title,
      'thumb_url': this.thumb_url,
      'desc': this.desc,
      'dur_s': this.dur_s
    };

    var obj = {
      'class': 'Video',
      'data': property_obj
    };
    return obj;
  };

  Video.prototype.setIndex = function() {
    this.isIndex = true;
  };

  Video.prototype.setNonIndex = function() {
    this.isIndex = false;
  };

  Video.prototype.toJson = function() {
    return JSON.stringify(this.toObj());
  };

  Video.fromJsonObject = function(obj) {
    return new Video(
        obj.data.id,
        obj.data.author,
        obj.data.title,
        obj.data.thumb_url,
        obj.data.desc,
        obj.data.dur_s
    );
  };

  var Queue = function(videos, index, playerTime_sec) {
    this.videos = videos;
    this.index = index;
    this.playerTime_sec = playerTime_sec;
  };

  Queue.prototype.toObj = function() {
    var videos_array = [];
    for (var i = 0; i < this.videos.length; i++) {
      videos_array.push(this.videos[i].toObj());
    }
    
    var property_obj = {
      'videos': videos_array,
      'index': this.index,
      'playerTime_sec': this.playerTime_sec
    };

    var obj = {
      'class': 'Queue',
      'data': property_obj
    };
    return obj;
  };

  Queue.prototype.toJson = function() {
    return JSON.stringify(this.toObj());
  };

  Queue.fromJsonObject = function(obj) {
    var videos = [];
    for (var i = 0; i < obj.data.videos.length; i++) {
      videos.push(Video.fromJsonObject(obj.data.videos[i]));
    }
    return new Queue(
        videos,
        obj.data.index,
        obj.data.playerTime_sec
    );
  };

  return {
    Video: Video,
    Queue: Queue
  };

});

// srv is the service which is being returned.  queue is now a property of srv because of a closure issue
app.factory('queueService', ['objects', function(objects) {
  var srv = {};

  srv.queue = new objects.Queue([], -1, 0);

  var indexObserverCbs = [];
  var videosObserverCbs = [];

  srv.regIndexObserverCb = function(cb) {
    indexObserverCbs.push(cb);
  };

  srv.regVideosObserverCb = function(cb) {
    videosObserverCbs.push(cb);
  };

  srv.notifyIndexObservers = function() {
    angular.forEach(indexObserverCbs, function(cb) {
      cb();
    });
  };

  srv.notifyVideosObservers = function() {
    angular.forEach(videosObserverCbs, function(cb) {
      cb();
    });
  };

  srv.setIndex = function(new_val) {
    if (srv.queue.index >= 0) {
      srv.queue.videos[srv.queue.index].setNonIndex();
    }
    srv.queue.index = new_val;
    srv.queue.videos[srv.queue.index].setIndex();
    srv.notifyIndexObservers();
  };

  srv.updateIndex = function() {
    for (var i = 0; i < srv.queue.videos.length; i++) {
      if (srv.queue.videos[i].isIndex) {
        srv.setIndex(i);
      }
    }
  };

  srv.hasNext = function() {
    return srv.queue.videos.length > srv.queue.index + 1;
  };

  srv.hasPrevious = function() {
    return (srv.queue.index - 1) >= 0;
  };

  srv.indexInBounds = function(index) {
    return index >=0 && index < srv.queue.videos.length;
  };

  srv.get = function(index) {
    if (srv.indexInBounds(index)) {
      return srv.queue.videos[index];
    } else {
      return undefined;
    }
  };

  srv.changeToIndex = function(index) {
    if (srv.indexInBounds(index)) {
      srv.setIndex(index);
      return srv.queue.videos[index];
    } else {
      return undefined;
    }
  };

  srv.next = function() {
    if (srv.hasNext()) {
      srv.setIndex(srv.queue.index + 1);
      return srv.queue.videos[srv.queue.index];
    } else {
      return undefined;
    }
  };

  srv.previous = function() {
    if (srv.hasPrevious()) {
      srv.setIndex(srv.queue.index - 1);
      return srv.queue.videos[srv.queue.index];
    } else {
      return undefined;
    }
  };

  srv.addVideo = function(video) {
    srv.queue.videos.push(video);
    srv.notifyVideosObservers();
  };

  srv.removeVideo = function(video) {
    var index = srv.queue.videos.indexOf(video);
    if (index > -1) {
      srv.removeVideoByIndex(index);
    }
  };

  srv.removeVideoByIndex = function(index) {
    if (srv.indexInBounds(index)) {
      if (index == srv.queue.index) {
        if (srv.hasNext()) {
          srv.setIndex(srv.queue.index + 1);
        } else if (srv.hasPrevious()) {
          srv.setIndex(srv.queue.index - 1);
        }
      }
      srv.queue.videos.splice(index, 1);
      srv.notifyVideosObservers();
    }
  };

  srv.insertVideo = function(video, index) {
    srv.queue.videos.splice(index, 0, video);
  };

  srv.setPlayerTime_sec = function(time) {
    srv.queue.playerTime_sec = time;
  };

  srv.getPlayerTime_sec = function() {
    return srv.queue.playerTime_sec;
  };

  srv.getVideos = function() {
    return srv.queue.videos;
  };

  srv.getIndex = function() {
    return srv.queue.index;
  };

  srv.toJson = function() {
    return srv.queue.toJson();
  };

  srv.notifyObservers = function() {
    srv.notifyIndexObservers();
    srv.notifyVideosObservers();
  };

  srv.loadFromJson = function(jsonText) {
    srv.queue = objects.Queue.fromJsonObject(JSON.parse(jsonText));
    srv.notifyObservers();
  };

  return srv;
}]);

app.value('searchConfig', {
  resultsPerSearchQuery: 10,
  baseQUrl: 'http://gdata.youtube.com/feeds/videos?alt=json'
});

app.factory('searchService', ['$http', 'searchConfig', 'objects', function($http, config, objects) {
  srv = {};

  var Search = function( q ) {
    this.q = q;
    this.searchIndex = 0;
    this.searchResults = [];
  };

  var formatSeconds = function(seconds) {
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    if (minutes < 10) {
      minutes = "0" + minutes;
    }

    var modSeconds = seconds % 60;
    if (modSeconds < 10) {
      modSeconds = "0" + modSeconds;
    }

    return (hours + ":" + minutes + ":" + modSeconds);

  };

  var filterGdata = function(data) {
    var newData = {}; //the object to be returned
    newData.startIndex = data.feed.openSearch$startIndex.$t;
    newData.totalResults = data.feed.openSearch$totalResults.$t;
    newData.itemsPerPage = data.feed.openSearch$itemsPerPage.$t;
    newData.results = [];

    // These are the 'video objects' which are used later
    for (var i in data.feed.entry) {
      var entry = data.feed.entry[i];
      
      // old obj's id is a url, with the last section holding the video ID
      var id = entry.id.$t.split('/').pop();

      var author = entry.author[0].name.$t;
      var title = entry.title.$t;
      var thumb_url = entry.media$group.media$thumbnail[0].url;
      var desc = entry.media$group.media$description.$t;

      var dur_s = formatSeconds(
          entry.media$group.yt$duration.seconds);

      var video = new objects.Video(id, author, title, thumb_url, desc, dur_s);

      newData.results.push(video);
    }

    return newData;
  };

  Search.prototype.generateQUri = function() {
    var start_index_qs = "&start-index=" + (this.searchIndex * config.resultsPerSearchQuery + 1);
    var max_results_qs = "&max-results=" + config.resultsPerSearchQuery;
    var search_qs = "&q=" + escape( this.q );
    return config.baseQUrl + start_index_qs + max_results_qs + search_qs;
  };

  Search.prototype.incrementSearchIndex = function() {
    this.searchIndex += 1;
  };

  Search.prototype.getSearchResults = function() {
    var ctx = this; // just to be safe
    return $http.get( ctx.generateQUri() )
        .then( function(res) {
          ctx.incrementSearchIndex();
          return filterGdata(res.data);
        });
  };

  Search.prototype.search = function() {
    var ctx = this;
    ctx.getSearchResults()
      .then( function(data) {
        ctx.searchResults.push(data);
      });
  };

  var searchIndex = 0;

  srv.resetSearchIndex = function() {
    searchIndex = 0;
  };

  srv.getSearchResults = function( q ) {
    var start_index_qs = "&start-index=" + (searchIndex * config.resultsPerSearchQuery + 1);
    var max_results_qs = "&max-results=" + config.resultsPerSearchQuery;
    var search_qs = "&q=" + escape(q);
    var qs = config.q_url + start_index_qs + max_results_qs + search_qs;
    return qs;
  };

  srv.Search = Search;

  return srv;
}]);

app.controller('AppController', [
    'queueService', 
    'searchService', 
    'objects', 
    'ytApi', 
    '$scope', 
    function(queueService, searchService, objects, ytApi, $scope) {

  window._q = queueService;
  window._s = searchService;
  window._y = ytApi;
  window._o = objects;
  window._$ = $scope;

  $scope.STATE = ytApi.STATE;

  $scope.videos = queueService.getVideos();
  $scope.videoIndex = queueService.getIndex();

  $scope.playerState = ytApi.playerState;
  $scope.playerTime_sec = ytApi.playerTime_sec;


  var initQueue = function() {
    first_vid = new objects.Video('FtKqic69xVo', 'VHS Documentaries', 'PBS Nova Tales From the Hive (2000, 2007)', 'null', 'desc', 3232);
    queueService.addVideo(first_vid);
  };

  initQueue();

  var onPlayerReady = function() {
    ytApi.play(queueService.next());
  };

  window.onYouTubeIframeAPIReady = function() {
    ytApi.onYouTubeIframeAPIReady();
  };

  var updatePlayerStatusBarModels = function() {

  };

  var updatePlayerState = function() {
    $scope.playerState = ytApi.playerState;
    $scope.$apply();
    console.log('updatePlayerState');
  };

  var updateVideos = function() {
    $scope.videos = queueService.getVideos();
    $scope.$apply();
    console.log('updateVideos');
  };

  var updateIndex = function() {
    $scope.videoIndex = queueService.getIndex();
    $scope.$apply();
    console.log('updateIndex');
  };

  ytApi.regStateObserverCb(updatePlayerState);
  ytApi.regReadyObserverCb(onPlayerReady);

  queueService.regVideosObserverCb(updateVideos);
  queueService.regIndexObserverCb(updateIndex);

  $scope.previous = function( e ) {
    console.log('previous clicked');
  };

  $scope.next = function( e ) {
    console.log('next clicked');
  };

  $scope.play_pause = function( e ) {
    console.log('play_pause clicked');
  };

  $scope.sortOptions = {
    stop: function(e, ui) {
      queueService.updateIndex();
    }
  };
}]);

app.directive('qtQueue', function() {
  return {
    restrict: 'E',
    replace: true,

    template: (
      '<div>' +
      '<div ng-model="videoIndex">{{ videoIndex }}</div>\n' + 
      '<div ng-model="videos" id="queue" ui-sortable="sortOptions">\n' +
      '<div ng-class="{\'video-index\': video.isIndex}" ng-repeat="video in videos track by $index">{{ video.title }}</div>\n' +
      '</div></div>\n'
    )
  };
});

app.directive('qtPlayer', function(config) {
  return {
    restrict: 'E',
    replace: true,
    transclude: true,
    template: '<div id="player"></div>'
  };
});

app.directive('qtPlayerStatusBar', function() {
  return {
    restrict: 'E',
    transclude: true,
    template: (
      '<div id="player-status-bar">\n' +
      'div ng-model="playerTime" style="class=""' +
      '</div>'
    )
  };
});

app.directive('qtPlayerButtons', function() {
  return {
    restrict: 'E',
    replace: true,
    template: (
      '<div class="player-button-wrap">\n' +
      '<div class="player-button previous" ng-click="previous()"></div>\n' +
      '<div class="player-button" ng-model="playerState" ng-class="(playerState == STATE.PLAYING) ? \'pause\' : \'play\'" ng-click="play_pause()">{{ playerState }}</div>\n' +
      '<div class="player-button next" ng-click="next()"></div>\n' +
      '</div>\n'
    )
  };
});

/*
vid1 = new _o.Video('12345', 'auth', 'title1', 'thumb_url', 'description1', 120);
vid2 = new _o.Video('12346', 'auth', 'title2', 'thumb_url', 'description1', 120);
vid3 = new _o.Video('12346', 'auth', 'title3', 'thumb_url', 'description1', 120);
vid4 = new _o.Video('12346', 'auth', 'title4', 'thumb_url', 'description1', 120);
vid5 = new _o.Video('12346', 'auth', 'title5', 'thumb_url', 'description1', 120);
vid6 = new _o.Video('12346', 'auth', 'title6', 'thumb_url', 'description1', 120);
_q.addVideo(vid1);
_q.addVideo(vid2);
_q.addVideo(vid3);
_q.addVideo(vid4);
_q.addVideo(vid5);
_q.addVideo(vid6);
*/