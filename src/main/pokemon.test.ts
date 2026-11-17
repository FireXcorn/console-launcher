import { describe, expect, it } from 'vitest'
import { pokemonConsole } from './catalog'

describe('console des jeux Pokémon', () => {
  it('range chaque jeu sur sa console', () => {
    expect(pokemonConsole('Pokémon X')).toBe('Nintendo 3DS')
    expect(pokemonConsole('Pokémon Platine')).toBe('Nintendo DS')
    expect(pokemonConsole('Pokémon Émeraude')).toBe('Game Boy Advance')
    expect(pokemonConsole('Pokémon Cristal')).toBe('Game Boy et Game Boy Color')
  })
  it('laisse Pokopia et les autres jeux sur l’accueil', () => {
    expect(pokemonConsole('Pokémon Pokopia')).toBeNull()
    expect(pokemonConsole('Pokémon Ranger')).toBeNull()
    expect(pokemonConsole('Pokémon XD : Le Souffle des Ténèbres')).toBeNull()
    expect(pokemonConsole('Mario Kart World')).toBeNull()
  })
})
