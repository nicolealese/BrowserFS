/**
 * Unit tests for MountableFileSystem's mount/unmount features.
 */
var fs = require('fs'),
    path = require('path'),
    assert = require('wrapped-assert'),
    Buffer = require('buffer').Buffer;

function codeAssertThrows(op, assertMsg) {
  var thrown = false;
  try {
    op();
  } catch (e) {
    thrown = true;
  } finally {
    assert(thrown, assertMsg);
  }
}

module.exports = function() {
  var oldmfs = fs.getRootFS();

  var rootForMfs = new BrowserFS.FileSystem.InMemory();
  BrowserFS.initialize(rootForMfs);
  fs.mkdirSync('/home');
  fs.mkdirSync('/home/anotherFolder');

  var newmfs = new BrowserFS.FileSystem.MountableFileSystem();
  // double mount, for funsies.
  newmfs.mount('/root', rootForMfs);
  // second mount is subdir of subdirectory that already exists in mount point.
  // also stresses our recursive mkdir code.
  newmfs.mount('/root/home/secondRoot', rootForMfs);
  newmfs.mount('/root/anotherRoot', rootForMfs);
  BrowserFS.initialize(newmfs);

  assert.equal(fs.readdirSync('/')[0], 'root', 'Invariant fail: Can query root directory.');

  var t1text = 'Invariant fail: Can query folder that contains items and a mount point.';
  var expectedHomeListing = ['anotherFolder', 'secondRoot'];
  var homeListing = fs.readdirSync('/root/home').sort();
  assert.deepEqual(homeListing, expectedHomeListing, t1text);

  fs.readdir('/root/home', function(err, files) {
    assert(!err, t1text);
    assert.deepEqual(files.sort(), expectedHomeListing, t1text);

    var t2text = "Invariant fail: Cannot delete a mount point.";
    codeAssertThrows(function() {
      fs.rmdirSync('/root/home/secondRoot');
    }, t2text);

    fs.rmdir('/root/home/secondRoot', function(err) {
      assert(err, t2text);
      assert(fs.statSync('/root/home').isDirectory(), "Invariant fail: Can stat a mount point.");

      var t4text = "Invariant fail: Cannot move a mount point.";
      codeAssertThrows(function() {
        fs.renameSync('/root/home/secondRoot', '/root/home/anotherFolder');
      }, t4text);

      fs.rename('/root/home/secondRoot', '/root/home/anotherFolder', function(err) {
        assert(err, t4text);

        fs.rmdirSync('/root/home/anotherFolder');

        var t5text = "Invariant fail: Cannot remove parent of mount point, even if empty in owning FS.";
        codeAssertThrows(function() {
          fs.rmdirSync('/root/home');
        }, t5text);

        fs.rmdir('/root/home', function(err) {
          assert(err, t5text);

          assert.deepEqual(fs.readdirSync('/root').sort(), ['anotherRoot', 'home'], "Invariant fail: Directory listings do not contain duplicate items when folder contains mount points w/ same names as existing files/folders.");

          var newRoot = new BrowserFS.FileSystem.InMemory();
          // Let's confuse things and mount something in '/'.
          newmfs.mount('/', newRoot);
          fs.mkdirSync('/home2');
          assert(fs.existsSync('/home2'));
          assert(newmfs.existsSync('/home2'));
          assert(fs.existsSync('/root'));
          newmfs.umount('/');
          assert(!fs.existsSync('/home2'));
        });
      });
    });

  });


  // Restore test FS on test end.
  process.on('exit', function() {
    BrowserFS.initialize(oldmfs);
  });
};