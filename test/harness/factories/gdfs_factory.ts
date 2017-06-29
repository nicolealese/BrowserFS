import GoogleDriveFileSystem from '../../../src/backend/GoogleDrive';
import {FileSystem} from '../../../src/core/file_system';

export default function GDFSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  if (GoogleDriveFileSystem.isAvailable()) {
    var oauthToken: any;

   var req = new XMLHttpRequest();
    req.open('GET', '/test/fixtures/gdfs/api.js');
    req.onerror = (e) => { console.log('foo');
    console.error(req.statusText); };
    req.onload = (e) => {
        console.log('bar');
      if (!(req.readyState === 4 && req.status === 200)) {
        console.error(req.statusText);
      }
      eval(req.response);
      onApiLoad();
    };
    req.send();

// loadScript("https://apis.google.com/js/api.js", onApiLoad);


// Use the API Loader script to load google.picker and gapi.auth.
var onApiLoad = () => {

    // load the APIs
    gapi.load('client:auth', onAuthApiLoad);
};


var onAuthApiLoad = () => {

  // The Client ID obtained from the Google Developers Console. Replace with your own Client ID.
  var clientId = "576255310053-nl3vla4sgg0cmu9ieb3l79fca2iuhrcs.apps.googleusercontent.com"

// Scope to use to access user's items.
var scope = ['https://www.googleapis.com/auth/drive'];

(<any>window).gapi.auth.authorize({
    'client_id': clientId,
    'scope': scope,
    'immediate': false
},
        // log the user in
        handleAuthResult);
};

var handleAuthResult = (authResult: any) => {
    if (authResult && !authResult.error) {
        oauthToken = authResult.access_token;
        gapi.client.load('drive', 'v2', () => {

    var fs = new GoogleDriveFileSystem(oauthToken);
    fs.empty(() => {
      cb('GoogleDrive', [fs]);
  });
        });
    }

};
} else {
  cb('GoogleDrive', []);
}
}
