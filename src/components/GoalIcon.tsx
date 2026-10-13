/**
 * GoalIcon — Cohesive, lightweight vector-style fitness icons.
 *
 * Implemented using pure React Native primitives for 100% consistent,
 * crisp rendering across iOS, Android, and Web without external font dependencies.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface GoalIconProps {
  /** Identifier of the goal */
  name: string;
  /** Primary stroke / fill color */
  color: string;
  /** Whether the parent card is selected */
  selected?: boolean;
}

export function GoalIcon({ name, color }: GoalIconProps) {
  switch (name) {
    case 'build_muscle':
      // Dumbbell / Barbell
      return (
        <View style={styles.iconBox}>
          {/* Left outer plate */}
          <View style={[styles.dumbbellOuterPlate, { backgroundColor: color }]} />
          {/* Left inner plate */}
          <View style={[styles.dumbbellInnerPlate, { backgroundColor: color }]} />
          {/* Center barbell bar */}
          <View style={[styles.dumbbellBar, { backgroundColor: color }]} />
          {/* Right inner plate */}
          <View style={[styles.dumbbellInnerPlate, { backgroundColor: color }]} />
          {/* Right outer plate */}
          <View style={[styles.dumbbellOuterPlate, { backgroundColor: color }]} />
        </View>
      );

    case 'lose_fat':
      // Energy / Calorie flame droplet
      return (
        <View style={styles.iconBox}>
          <View style={[styles.flameOuter, { borderColor: color }]}>
            <View style={[styles.flameInnerCore, { backgroundColor: color }]} />
          </View>
        </View>
      );

    case 'build_muscle_lose_fat':
      // Dual transformation / Synergy balance
      return (
        <View style={styles.iconBox}>
          {/* Upper left curved pill */}
          <View style={[styles.dualBarTop, { backgroundColor: color }]} />
          {/* Center connector dot */}
          <View style={[styles.dualCenterDot, { backgroundColor: color }]} />
          {/* Lower right curved pill */}
          <View style={[styles.dualBarBottom, { backgroundColor: color }]} />
        </View>
      );

    case 'get_stronger':
      // Stepped athletic strength bars
      return (
        <View style={styles.iconBox}>
          <View style={[styles.strengthBar, { height: 7, backgroundColor: color }]} />
          <View style={[styles.strengthBar, { height: 11, backgroundColor: color }]} />
          <View style={[styles.strengthBar, { height: 16, backgroundColor: color }]} />
        </View>
      );

    case 'improve_fitness':
      // Vitality / Cardio pulse wave
      return (
        <View style={styles.iconBox}>
          <View style={[styles.pulseLine, { backgroundColor: color }]} />
          <View style={[styles.pulsePeak, { borderColor: color }]} />
          <View style={[styles.pulseLine, { backgroundColor: color }]} />
        </View>
      );

    case 'not_sure':
    default:
      // Compass / Directional guide
      return (
        <View style={styles.iconBox}>
          <View style={[styles.compassRing, { borderColor: color }]}>
            <View style={[styles.compassPointer, { backgroundColor: color }]} />
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  // Dumbbell
  dumbbellOuterPlate: {
    width: 2.5,
    height: 14,
    borderRadius: 1.5,
  },
  dumbbellInnerPlate: {
    width: 2,
    height: 10,
    borderRadius: 1,
    marginLeft: 1.5,
    marginRight: 1.5,
  },
  dumbbellBar: {
    width: 6,
    height: 2.5,
    borderRadius: 1,
  },
  // Flame
  flameOuter: {
    width: 14,
    height: 17,
    borderWidth: 2,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 2,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameInnerCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Dual
  dualBarTop: {
    width: 8,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 6,
    marginRight: 2,
  },
  dualCenterDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  dualBarBottom: {
    width: 8,
    height: 3,
    borderRadius: 1.5,
    marginTop: 6,
    marginLeft: 2,
  },
  // Strength
  strengthBar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1.5,
  },
  // Pulse
  pulseLine: {
    width: 4,
    height: 2,
    borderRadius: 1,
  },
  pulsePeak: {
    width: 9,
    height: 12,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginHorizontal: 1,
  },
  // Compass
  compassRing: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassPointer: {
    width: 4,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
