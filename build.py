#!/usr/bin/env python3
"""Assemble index.html from .head_clean.html + src/*.js (deterministic build)."""
import sys
HEAD = '.head_clean.html'
ORDER = ['00_base.js', '05_world.js', '10_player.js', '20_combat.js', '30_enemies.js',
         '35_bosses.js', '40_npc_quests.js', '50_save_camera.js', '55_status.js',
         '60_ui.js', '70_story.js']
CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'


def main():
    head = open(HEAD).read()
    js = ''.join(open('src/' + f).read() for f in ORDER)
    for m in ('</script>', '</body>', '</html>'):
        js = js.replace(m, '')
    out = (head + '<script src="' + CDN + '"></script>\n<script>\n' + js +
           '\n</script>\n</body>\n</html>\n')
    open('index.html', 'w').write(out)
    print('built index.html:', len(out), 'bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
