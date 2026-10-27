import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useCoverColor } from "../hooks/useCoverColor";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { usePlayer } from "../player/PlayerContext";
import { toggleFavoriteId } from "../services/favorites";
import { colors, seedColor } from "../theme/colors";
import { display } from "../theme/typography";
import type { Song } from "../types/song";
import { haptics } from "../utils/haptics";
import { formatDuration, getArtistName } from "../utils/media";
import ActionSheet, { type SheetOption } from "./ActionSheet";
import Cover from "./Cover";
import SongRow from "./SongRow";

// Uma volta completa do disco, em milissegundos.
const SPIN_DURATION = 26000;

// Quanto é preciso arrastar o disco para passar de música, e quanto
// é preciso puxar o leitor para baixo para o fechar.
const SWIPE_DISTANCE = 90;
const CLOSE_DISTANCE = 120;

// Sulcos do vinil, em fração do diâmetro do disco (fora do rótulo).
const GROOVES = [0.94, 0.85, 0.76, 0.67, 0.58];
// O rótulo — a capa da música — ocupa o centro, como num disco a sério.
const LABEL_RATIO = 0.46;

// De onde vem a música que está a tocar, para o topo do leitor.
// O nome só aparece quando o temos de facto (álbum e artista vêm na
// própria música; de uma playlist só sabemos que é uma playlist).
function describeSource(queueId: string | null, song: Song) {
  if (queueId?.startsWith("album:")) {
    return { eyebrow: "A TOCAR DO ÁLBUM", name: song.album?.title ?? null };
  }
  if (queueId?.startsWith("artista:")) {
    return { eyebrow: "A TOCAR DO ARTISTA", name: getArtistName(song) };
  }
  if (queueId?.startsWith("playlist:")) {
    return { eyebrow: "A TOCAR DA PLAYLIST", name: null };
  }
  if (queueId === "inicio") return { eyebrow: "A TOCAR DO INÍCIO", name: null };
  if (queueId === "favoritos") {
    return { eyebrow: "A TOCAR DOS FAVORITOS", name: null };
  }
  if (queueId === "biblioteca") {
    return { eyebrow: "A TOCAR DA BIBLIOTECA", name: null };
  }
  return { eyebrow: "A TOCAR", name: null };
}

export default function MusicPlayer() {
  const {
    player,
    currentSong,
    queue,
    hasNext,
    hasPrevious,
    shuffleOn,
    repeat,
    error,
    queueId,
    playNext,
    playPrevious,
    playSong,
    togglePlayback,
    toggleShuffle,
    toggleRepeat,
    closePlayer,
    playAfterCurrent,
    removeFromQueue,
  } = usePlayer();
  const status = useAudioPlayerStatus(player);
  const { width, height } = useWindowDimensions();
  const [barWidth, setBarWidth] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  // A capa acompanha o tamanho do ecrã: em telemóveis mais baixos encolhe,
  // para que título, barra e controlos caibam sem ficarem apertados.
  const compact = height < 740;
  const coverSize = Math.round(
    Math.min(width - 72, height * (compact ? 0.34 : 0.38), 320)
  );
  const gap = compact ? 16 : 24;
  const labelSize = Math.round(coverSize * LABEL_RATIO);

  // Capa a rodar devagar, como um disco, enquanto a música toca.
  // Ao pausar guardamos a fração já rodada, para retomar daí em vez
  // de a capa saltar para trás.
  const spin = useRef(new Animated.Value(0)).current;
  const spun = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!status.playing) {
      if (startedAt.current) {
        spun.current =
          (spun.current + (Date.now() - startedAt.current) / SPIN_DURATION) % 1;
        startedAt.current = 0;
      }

      return;
    }

    let cancelled = false;
    startedAt.current = Date.now();

    function turn(from: number) {
      spin.setValue(from);

      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION * (1 - from),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) turn(0);
      });
    }

    turn(spun.current);

    return () => {
      cancelled = true;
      spin.stopAnimation();
    };
  }, [status.playing, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // A cor do fundo vem da capa real (calculada pelo servidor) e, enquanto
  // não chega ou se a capa não tiver cor, da cor de reserva da música.
  // Troca com um esbatimento, em vez de saltar de uma cor para a outra.
  const coverColor = useCoverColor(currentSong?.cover_url);
  const tint = useRef(seedColor(currentSong?.id ?? 0));
  const [tints, setTints] = useState({ from: tint.current, to: tint.current });
  const tintFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!currentSong) return;

    const next = coverColor ?? seedColor(currentSong.id);

    if (next === tint.current) return;

    setTints({ from: tint.current, to: next });
    tint.current = next;
    tintFade.setValue(0);

    Animated.timing(tintFade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [currentSong, coverColor, tintFade]);

  // ---------- Favorito ----------
  const favoriteIds = useFavoriteIds();
  const heartScale = useRef(new Animated.Value(1)).current;

  // ---------- Transição ao mudar de música ----------
  // O rótulo do disco e o título entram com um desvanecimento curto, para
  // a troca parecer intencional. Na primeira música não: o leitor já está
  // a subir, e duas animações ao mesmo tempo atrapalham-se.
  const swap = useRef(new Animated.Value(1)).current;
  const firstSong = useRef(true);
  const currentId = currentSong?.id;

  useEffect(() => {
    if (currentId == null) return;

    if (firstSong.current) {
      firstSong.current = false;
      return;
    }

    swap.setValue(0);
    Animated.timing(swap, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentId, swap]);

  // ---------- Menu de uma música da fila ----------
  const [queueMenuFor, setQueueMenuFor] = useState<Song | null>(null);

  // ---------- Gestos ----------
  // Deslizar o disco para os lados passa de música; puxar para baixo (no
  // topo, ou no disco com a página no início) fecha o leitor. Os gestos
  // são criados uma vez, por isso leem o estado atual destas referências.
  const discX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollTop = useRef(0);
  const gestureMode = useRef<"skip" | "close" | null>(null);
  const live = useRef({ hasNext, hasPrevious, playNext, playPrevious, closePlayer, width });

  live.current = { hasNext, hasPrevious, playNext, playPrevious, closePlayer, width };

  function settle(value: Animated.Value) {
    Animated.spring(value, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }

  function releaseClose(dy: number, vy: number) {
    if (dy > CLOSE_DISTANCE || vy > 0.9) {
      haptics.light();
      live.current.closePlayer();
    } else {
      settle(dragY);
    }
  }

  function releaseSkip(dx: number, vx: number) {
    const { hasNext: canNext, hasPrevious: canPrevious, width: screen } = live.current;
    const goNext = (dx < -SWIPE_DISTANCE || vx < -0.6) && canNext;
    const goPrevious = (dx > SWIPE_DISTANCE || vx > 0.6) && canPrevious;

    if (!goNext && !goPrevious) {
      settle(discX);
      return;
    }

    haptics.light();

    // O disco sai pelo lado do gesto e o seguinte entra pelo outro.
    Animated.timing(discX, {
      toValue: goNext ? -screen : screen,
      duration: 170,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (goNext) live.current.playNext();
      else live.current.playPrevious();

      discX.setValue(goNext ? screen * 0.5 : -screen * 0.5);
      settle(discX);
    });
  }

  const closeDrag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => releaseClose(g.dy, g.vy),
      onPanResponderTerminate: () => settle(dragY),
    })
  ).current;

  const discGesture = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        const sideways = Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
        const pullDown =
          g.dy > 14 && g.dy > Math.abs(g.dx) * 1.5 && scrollTop.current <= 0;

        gestureMode.current = sideways ? "skip" : pullDown ? "close" : null;
        return gestureMode.current !== null;
      },
      // Depois de o disco apanhar o gesto, a página não lho tira.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (gestureMode.current === "close") {
          dragY.setValue(Math.max(0, g.dy));
          return;
        }

        // Sem música para onde ir, o disco resiste em vez de seguir o dedo.
        const { hasNext: canNext, hasPrevious: canPrevious } = live.current;
        const blocked = (g.dx < 0 && !canNext) || (g.dx > 0 && !canPrevious);
        discX.setValue(blocked ? g.dx * 0.25 : g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (gestureMode.current === "close") releaseClose(g.dy, g.vy);
        else releaseSkip(g.dx, g.vx);
        gestureMode.current = null;
      },
      onPanResponderTerminate: () => {
        settle(discX);
        settle(dragY);
        gestureMode.current = null;
      },
    })
  ).current;

  // Arrastar a barra: enquanto o dedo está em baixo a barra segue-o, e
  // só ao levantar é que a música salta para a posição escolhida.
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const knobScale = useRef(new Animated.Value(1)).current;
  const barWidthRef = useRef(0);
  const durationRef = useRef(0);
  const playerRef = useRef(player);

  durationRef.current = status.duration || 0;
  playerRef.current = player;

  const scrubber = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setScrubAt(positionFrom(event.nativeEvent.locationX));
        springKnob(1.7);
      },
      onPanResponderMove: (event) => {
        setScrubAt(positionFrom(event.nativeEvent.locationX));
      },
      onPanResponderRelease: (event) => {
        const position = positionFrom(event.nativeEvent.locationX);

        haptics.selection();
        setScrubAt(null);
        springKnob(1);

        if (durationRef.current > 0) {
          void playerRef.current.seekTo(position * durationRef.current);
        }
      },
      onPanResponderTerminate: () => {
        setScrubAt(null);
        springKnob(1);
      },
    })
  ).current;

  function positionFrom(locationX: number) {
    if (barWidthRef.current <= 0) return 0;
    return Math.max(0, Math.min(locationX / barWidthRef.current, 1));
  }

  function springKnob(toValue: number) {
    Animated.spring(knobScale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  }

  if (!currentSong) return null;

  const duration = status.duration || 0;
  const currentTime = status.currentTime || 0;
  const livePosition = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  // Enquanto se arrasta, manda o dedo; de resto, manda a música.
  const progress = scrubAt ?? livePosition;
  const shownTime = scrubAt != null ? scrubAt * duration : currentTime;
  const source = describeSource(queueId, currentSong);

  const songId = currentSong.id;
  const isFavorite = favoriteIds.includes(songId);

  const handleFavorite = () => {
    // Ao guardar, o coração dá um pequeno salto; ao tirar, só muda.
    if (isFavorite) {
      haptics.selection();
    } else {
      haptics.success();
      heartScale.setValue(0.6);
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 14,
      }).start();
    }

    toggleFavoriteId(songId).catch((err) =>
      console.error("Erro ao guardar favorito:", err)
    );
  };

  const swapShift = swap.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const labelScale = swap.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const discFade = discX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [0.2, 1, 0.2],
    extrapolate: "clamp",
  });

  const menuTarget = queueMenuFor;
  const queueMenu: SheetOption[] = menuTarget
    ? [
        {
          icon: "play-forward-outline",
          title: "Tocar a seguir",
          description: "Passa para logo depois desta música",
          onPress: () => {
            haptics.selection();
            playAfterCurrent(menuTarget.id);
          },
        },
        {
          icon: "remove-circle-outline",
          title: "Tirar da fila",
          description: "Continua na tua biblioteca",
          onPress: () => {
            haptics.selection();
            removeFromQueue(menuTarget.id);
          },
        },
      ]
    : [];
  const remainingCount = Math.max(
    queue.length - 1 - queue.findIndex((song) => song.id === currentSong.id),
    0
  );

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: dragY }] }]}>
      {/* Luz de fundo com a cor da música, que troca ao mudar de faixa. */}
      <View style={styles.backdrop} pointerEvents="none">
        <LinearGradient
          colors={[tints.from, colors.background]}
          style={styles.backdropLayer}
        />
        <Animated.View style={[styles.backdropLayer, { opacity: tintFade }]}>
          <LinearGradient
            colors={[tints.to, colors.background]}
            style={styles.backdropLayer}
          />
        </Animated.View>
      </View>

      {/* Zona do topo: puxar daqui para baixo fecha o leitor. */}
      <View {...closeDrag.panHandlers}>
        <View style={styles.grabber} />

      <View style={styles.topBar}>
        <Pressable
          onPress={closePlayer}
          style={({ pressed }) => [styles.topButton, pressed && styles.topPressed]}
          accessibilityRole="button"
          accessibilityLabel="Fechar o leitor"
        >
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>

        <View style={styles.source}>
          <Text style={styles.sourceEyebrow} numberOfLines={1}>
            {source.eyebrow}
          </Text>
          {!!source.name && (
            <Text style={styles.sourceName} numberOfLines={1}>
              {source.name}
            </Text>
          )}
        </View>

        {/* Ocupa o mesmo espaço que o botão, para a origem ficar ao centro. */}
        <View style={styles.topButton} />
      </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollTop.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
      >
        <Animated.View
          style={[
            styles.coverWrap,
            {
              width: coverSize,
              height: coverSize,
              marginBottom: gap + 6,
              opacity: discFade,
              transform: [{ translateX: discX }],
            },
          ]}
          accessibilityHint="Desliza para os lados para mudar de música"
          {...discGesture.panHandlers}
        >
          <View
            style={[
              styles.glow,
              {
                width: coverSize * 0.9,
                height: coverSize * 0.9,
                borderRadius: coverSize,
                backgroundColor: tints.to,
                shadowColor: tints.to,
              },
            ]}
          />
          {/* Vinil preto com sulcos e a capa no centro, como rótulo. */}
          <Animated.View
            style={[
              styles.disc,
              {
                width: coverSize,
                height: coverSize,
                borderRadius: coverSize / 2,
                transform: [{ rotate }],
              },
            ]}
          >
            {GROOVES.map((ratio) => (
              <View
                key={ratio}
                style={[
                  styles.groove,
                  {
                    width: coverSize * ratio,
                    height: coverSize * ratio,
                    borderRadius: (coverSize * ratio) / 2,
                  },
                ]}
              />
            ))}

            <Animated.View
              style={{ opacity: swap, transform: [{ scale: labelScale }] }}
            >
              <Cover
                path={currentSong.cover_url}
                seed={currentSong.id}
                size={labelSize}
                radius={labelSize / 2}
                icon={false}
                style={styles.label}
              />
            </Animated.View>
            <View style={styles.spindle} />
          </Animated.View>

          {/* A luz não roda com o disco: é este reflexo parado que faz o
              olho ler um objeto a girar, e não uma imagem a rodar. */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(255,255,255,0.13)",
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.05)",
            ]}
            locations={[0, 0.38, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.sheen,
              { width: coverSize, height: coverSize, borderRadius: coverSize / 2 },
            ]}
          />
        </Animated.View>

        {/* Título ao centro, coração à direita e um espaço igual à esquerda
            para o título não sair do centro. */}
        <Animated.View
          style={[
            styles.titleRow,
            {
              marginBottom: error ? 14 : gap,
              opacity: swap,
              transform: [{ translateY: swapShift }],
            },
          ]}
        >
          <View style={styles.titleSide} />

          <View style={styles.titleText}>
            <Text style={styles.title} numberOfLines={2}>
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {getArtistName(currentSong)}
            </Text>
          </View>

          <Pressable
            onPress={handleFavorite}
            style={styles.titleSide}
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            accessibilityLabel={
              isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
            }
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={28}
                color={isFavorite ? colors.primaryLight : colors.textSecondary}
              />
            </Animated.View>
          </Pressable>
        </Animated.View>

        {!!error && (
          <View style={[styles.errorBox, { marginBottom: gap }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View
          style={styles.progressTouch}
          onLayout={(event) => {
            barWidthRef.current = event.nativeEvent.layout.width;
            setBarWidth(event.nativeEvent.layout.width);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Progresso da música"
          {...scrubber.panHandlers}
        >
          <View style={[styles.progressTrack, scrubAt != null && styles.trackThick]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Animated.View
            style={[
              styles.progressKnob,
              {
                left: Math.max(progress * barWidth - 7, 0),
                transform: [{ scale: knobScale }],
              },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.time, scrubAt != null && styles.timeOn]}>
            {error ? "--:--" : formatDuration(shownTime)}
          </Text>
          <Text style={styles.time}>
            {error ? "--:--" : formatDuration(duration)}
          </Text>
        </View>

        <View style={[styles.controls, { marginTop: compact ? 0 : 6 }]}>
          <Pressable
            onPress={() => {
              haptics.selection();
              toggleShuffle();
            }}
            style={[styles.sideButton, shuffleOn && styles.sideButtonOn]}
            accessibilityRole="button"
            accessibilityLabel={shuffleOn ? "Desativar ordem aleatória" : "Ativar ordem aleatória"}
            accessibilityState={{ selected: shuffleOn }}
          >
            <Ionicons
              name="shuffle"
              size={22}
              color={shuffleOn ? colors.white : colors.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.light();
              playPrevious();
            }}
            disabled={!hasPrevious}
            style={[styles.skipButton, !hasPrevious && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Música anterior"
          >
            <Ionicons name="play-skip-back" size={30} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.medium();
              togglePlayback();
            }}
            style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
            accessibilityRole="button"
            accessibilityLabel={status.playing ? "Pausar" : "Reproduzir"}
          >
            <Ionicons
              name={status.playing ? "pause" : "play"}
              size={34}
              color={colors.white}
              style={status.playing ? undefined : styles.playIconOffset}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.light();
              playNext();
            }}
            disabled={!hasNext}
            style={[styles.skipButton, !hasNext && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Próxima música"
          >
            <Ionicons name="play-skip-forward" size={30} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.selection();
              toggleRepeat();
            }}
            style={[styles.sideButton, repeat && styles.sideButtonOn]}
            accessibilityRole="button"
            accessibilityLabel={repeat ? "Desativar repetição" : "Repetir esta música"}
            accessibilityState={{ selected: repeat }}
          >
            <Ionicons
              name="repeat"
              size={22}
              color={repeat ? colors.white : colors.textSecondary}
            />
          </Pressable>
        </View>


        <View style={styles.queueCard}>
          <Pressable
            onPress={() => setQueueOpen((open) => !open)}
            style={styles.queueHeader}
            accessibilityRole="button"
            accessibilityState={{ expanded: queueOpen }}
          >
            <View style={styles.queueIcon}>
              <Ionicons name="list" size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.queueInfo}>
              <Text style={styles.queueTitle}>A seguir</Text>
              <Text style={styles.queueCount}>
                {remainingCount === 0
                  ? "Última música da fila"
                  : `${remainingCount} ${remainingCount === 1 ? "música" : "músicas"}`}
              </Text>
            </View>
            <Ionicons
              name={queueOpen ? "chevron-down" : "chevron-up"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {queueOpen && (
            <View style={styles.queueList}>
              {queue.map((song, index) => {
                const isCurrent = song.id === currentSong.id;

                return (
                  <SongRow
                    key={song.id}
                    song={song}
                    position={index + 1}
                    active={isCurrent}
                    showDuration={!isCurrent}
                    // Mesma fila, mesma origem: escolher a seguinte não muda de onde se ouve.
                    onPress={() => playSong(song, queue, queueId)}
                    trailing={
                      isCurrent ? (
                        <View style={styles.nowPlaying}>
                          <Ionicons name="stats-chart" size={16} color={colors.primaryLight} />
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => setQueueMenuFor(song)}
                          style={styles.nowPlaying}
                          accessibilityRole="button"
                          accessibilityLabel={`Opções: ${song.title}`}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={18}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                      )
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuTarget !== null}
        options={queueMenu}
        onClose={() => setQueueMenuFor(null)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Ocupa a parte de cima do ecrã, por trás da capa.
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 560,
    opacity: 0.5,
  },
  backdropLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  // A pega: diz, sem palavras, que o leitor se puxa para baixo.
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  topButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  topPressed: {
    opacity: 0.6,
  },
  source: {
    flex: 1,
    alignItems: "center",
  },
  sourceEyebrow: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    opacity: 0.75,
  },
  sourceName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  coverWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  // Halo discreto: dá profundidade sem roubar atenção à capa.
  glow: {
    position: "absolute",
    backgroundColor: colors.primary,
    opacity: 0.12,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  // O vinil: um preto ligeiramente diferente do fundo, para o disco se
  // destacar sem precisar de contorno colorido.
  disc: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141110",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  groove: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.045)",
  },
  label: {
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.35)",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  // Furo central do disco, por cima do rótulo.
  spindle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 14,
    height: 14,
    marginTop: -7,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  titleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  titleSide: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    ...display.card,
    color: colors.text,
    fontSize: 25,
    textAlign: "center",
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  progressTouch: {
    width: "100%",
    height: 34,
    justifyContent: "center",
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  // A barra engrossa enquanto o dedo está em cima dela.
  trackThick: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressKnob: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 18,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  errorText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 19,
  },
  timeOn: {
    color: colors.text,
    fontWeight: "700",
  },
  controls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  // Ativo: círculo roxo preenchido, que se lê de relance —
  // ao contrário da luz pequena que estava aqui antes.
  sideButtonOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  skipButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.3,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  playPressed: {
    transform: [{ scale: 0.95 }],
  },
  playIconOffset: {
    marginLeft: 4,
  },
  queueCard: {
    width: "100%",
    marginTop: 28,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
  },
  queueIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  queueInfo: {
    flex: 1,
  },
  queueTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  queueCount: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  queueList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },
  nowPlaying: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
