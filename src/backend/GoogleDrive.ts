import {BaseFileSystem, FileSystem, BFSOneArgCallback, BFSCallback} from '../core/file_system';
import {default as Stats, FileType} from '../core/node_fs_stats';
import * as path from 'path';

/**
 * A read/write file system backed by Google Drive cloud storage.
 *
 * Uses the Google REST API.
 *
 */
 export default class GoogleDriveFileSystem extends BaseFileSystem implements FileSystem {

   private _client: any;
   private _oauthToken: any;

constructor(client: any, oauthToken: any) {
  super();
  this._client = client;
  this._oauthToken = oauthToken;
}

 public getName(): string {
 return 'Google Drive';
 }

 public isReadOnly(): boolean {
   return false;
 }

 public supportsProps(): boolean {
   return false;
 }

 public supportsSynch(): boolean {
   return false;
 }
 public static isAvailable(): boolean {
   return true;
 }
 public empty(mainCb: BFSOneArgCallback): void {
   mainCb();
}

  public stat(path: string, isLstat: boolean, cb: BFSCallback<Stats>): void {
    // Ignore lstat case -- GoogleDrive doesn't support symlinks
    // Stat the file


        const stats = new Stats(FileType.DIRECTORY, 0, 0);
        return cb(null, stats);
  }

  /**
   * Create a directory
   */
  public mkdir(p: string, mode: number, cb: BFSOneArgCallback): void {
    // Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
    // directory and all its ancestors if they don't exist.
    // Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
    // is made to create a directory without a parent.
    // To handle this inconsistency, a check for the existence of `path`'s parent
    // must be performed before it is created, and an error thrown if it does
    // not exist
  // const title = path.basename(p);
  //   const dir = path.dirname(p);
  //   const base = path.basename(dir);

  //   var request = this._client.drive.files.list({
  //       "q": "title = '" + base + "'"
  //   });
  //   request.execute((resp: any) => {
  //       var id = resp.items[0].id;
  //       console.log('id in callback = ' + id)

  //       var access_token = this._oauthToken;
  //       var secondRequest = this._client.request({
  //           'path': '/drive/v2/files/',
  //           'method': 'POST',
  //           'headers': {
  //               'Content-Type': 'application/json',
  //               'Authorization': 'Bearer ' + access_token,
  //           },
  //           'body': {
  //               "title": title,
  //               "parents": [{
  //                   "id": id
  //               }],
  //               "mimeType": "application/vnd.google-apps.folder",
  //           }
  //       });

  //       secondRequest.execute(function(resp: any) {
  //           console.log('nested folder done creating')
  //            // cb(null); 
  //       })
  //   });
  //   cb(null); 
  // }

  const title = path.basename(p);
    const dir = path.dirname(p);
    const base = path.basename(dir);

    var request = this._client.drive.files.list({
        "q": "title = '" + base + "'"
    });
    request.execute((resp: any) => {
        if(typeof resp.items[0] !== 'undefined' && typeof resp.items[0].id !== 'undefined'){
        var id = resp.items[0].id;
        console.log('id in callback = ' + id)

        
            console.log("defined");
              var access_token = this._oauthToken;
        var secondRequest = this._client.request({
            'path': '/drive/v2/files/',
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + access_token,
            },
            'body': {
                "title": title,
                "parents": [{
                    "id": id
                }],
                "mimeType": "application/vnd.google-apps.folder",
            }
        });

        secondRequest.execute(function(resp: any) {
            console.log('nested folder done creating')
        })

        }

        else {
            console.log("undefined");
            var access_token = this._oauthToken;
        var secondRequest = this._client.request({
            'path': '/drive/v2/files/',
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + access_token,
            },
            'body': {
                "title": title,
                "mimeType": "application/vnd.google-apps.folder",
            }
        });

        secondRequest.execute(function(resp: any) {
            console.log('folder done creating')
        })

        }

      
    });
    cb(null); 
  }

 }
