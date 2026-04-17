import * as migration_20260325_204544 from './20260325_204544'
import * as migration_20260327_122941 from './20260327_122941'
import * as migration_20260329_create_cms_schema from './20260329_create_cms_schema'
import * as migration_20260330_move_to_cms_schema from './20260330_move_to_cms_schema'
import * as migration_20260329_141830 from './20260329_141830'

export const migrations = [
  {
    up: migration_20260325_204544.up,
    down: migration_20260325_204544.down,
    name: '20260325_204544',
  },
  {
    up: migration_20260327_122941.up,
    down: migration_20260327_122941.down,
    name: '20260327_122941',
  },
  {
    up: migration_20260329_create_cms_schema.up,
    down: migration_20260329_create_cms_schema.down,
    name: '20260329_create_cms_schema',
  },
  {
    up: migration_20260330_move_to_cms_schema.up,
    down: migration_20260330_move_to_cms_schema.down,
    name: '20260330_move_to_cms_schema',
  },
  {
    up: migration_20260329_141830.up,
    down: migration_20260329_141830.down,
    name: '20260329_141830',
  },
]
