import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import '../../styles/market/Market.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoins, faCampground, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, useCursor, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import oracleWhisperSprite from '../../assets/items/blessings/oracles_whisper.png';
import cartographersInsightSprite from '../../assets/items/blessings/cartographers_insight.png';
import candleOfMercySprite from '../../assets/items/blessings/candle_of_mercy.png';
import bloodOathInkSprite from '../../assets/items/illusions/blood_oath_ink.png';
import spiderSwarmSprite from '../../assets/items/illusions/spider_swarm.png';
import danceOfTheJesterSprite from '../../assets/items/illusions/dance_of_the_jester.png';
import coneOfColdSprite from '../../assets/items/illusions/cone_of_cold.png';
import sealOfSilenceSprite from '../../assets/items/curses/seal_of_silence.png';
import voidbrandSprite from '../../assets/items/curses/voidbrand.png';
import edictOfCompulsionSprite from '../../assets/items/curses/edict_of_compulsion.png';
import executionersCutSprite from '../../assets/items/curses/executioners_cut.png';
import sendInTheClownSprite from '../../assets/items/illusions/clown.png';
import marketHubMapDesktop from '../../assets/market/market_hub_map_desktop.png';
import marketHubMapMobile from '../../assets/market/market_hub_map_mobile.png';
import subshopIllusionDesktop from '../../assets/market/subshop_illusion_desktop.png';
import subshopIllusionMobile from '../../assets/market/subshop_illusion_mobile.png';
import subshopBlessingDesktop from '../../assets/market/subshop_blessing_desktop.png';
import subshopBlessingMobile from '../../assets/market/subshop_blessing_mobile.png';
import subshopCurseDesktop from '../../assets/market/subshop_curse_desktop.png';
import subshopCurseMobile from '../../assets/market/subshop_curse_mobile.png';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

const CATEGORY_META = [
  {
    key: 'illusion',
    label: 'Illusions',
    description: 'Cosmetic theatrics and battlefield glamours.'
  },
  {
    key: 'blessing',
    label: 'Blessings',
    description: 'Guiding lights that bend the odds in your favor.'
  },
  {
    key: 'curse',
    label: 'Curses',
    description: 'Dark bargains meant to stifle your rivals.'
  }
];

const STALLS = [
  {
    key: 'illusion',
    label: 'Illusions',
    color: '#7fc8ff',
    accent: '#2c5b9a',
    position: [-4.2, 0, 2.6],
    mobilePosition: [-2.4, 0, 2.0],
  },
  {
    key: 'blessing',
    label: 'Blessings',
    color: '#88e3b6',
    accent: '#256a4f',
    position: [4.2, 0, 2.6],
    mobilePosition: [2.4, 0, 5.2],
  },
  {
    key: 'curse',
    label: 'Curses',
    color: '#f09a9a',
    accent: '#7a2c2c',
    position: [0, 0, -4.8],
    mobilePosition: [0.0, 0, -3.2],
  },
];

const MARKET_HUB_MAPS = {
  desktop: {
    src: marketHubMapDesktop,
    width: 1536,
    height: 1024,
    areas: {
      // Tuned to actual generated hub map stall silhouettes/signs (1536x1024)
      illusion: { x: 65, y: 250, width: 470, height: 490 },
      curse: { x: 495, y: 185, width: 560, height: 500 },
      blessing: { x: 970, y: 250, width: 500, height: 500 },
    },
  },
  mobile: {
    src: marketHubMapMobile,
    width: 1024,
    height: 1536,
    areas: {
      // Tuned to actual generated hub map stall silhouettes/signs (1024x1536)
      curse: { x: 300, y: 315, width: 425, height: 500 },
      illusion: { x: 75, y: 760, width: 390, height: 500 },
      blessing: { x: 545, y: 785, width: 400, height: 485 },
    },
  },
};

// Legacy scene code below is currently not used (map-only mode), but still compiled.
// Keep aliases so removed old assets don't break builds.
const marketGroundTile = marketHubMapDesktop;
const marketFog = marketHubMapDesktop;
const marketShadowBlob = marketHubMapDesktop;
const stallIllusionBackplate = subshopIllusionDesktop;
const stallBlessingBackplate = subshopBlessingDesktop;
const mascotIllusionJester = subshopIllusionDesktop;
const mascotBlessingOracle = subshopBlessingDesktop;
const propIllusionMirror = subshopIllusionDesktop;
const propBlessingCandles = subshopBlessingDesktop;
const signIllusion = subshopIllusionDesktop;
const signBlessing = subshopBlessingDesktop;
const stallCurseBackplate = subshopCurseDesktop;
const mascotCurseOathbinder = subshopCurseDesktop;
const propCurseTome = subshopCurseDesktop;
const signCurse = subshopCurseDesktop;

const STALL_STAGE_ART = {
  illusion: {
    desktop: subshopIllusionDesktop,
    mobile: subshopIllusionMobile,
  },
  blessing: {
    desktop: subshopBlessingDesktop,
    mobile: subshopBlessingMobile,
  },
  curse: {
    desktop: subshopCurseDesktop,
    mobile: subshopCurseMobile,
  },
};

const CameraRig = ({ activeCategory, isZoomed }) => {
  const cameraRef = useRef(null);
  const targetRef = useRef({ position: [12, 12, 12], lookAt: [0, 0, 0], zoom: 60 });
  const { size } = useThree();

  useEffect(() => {
    const isMobile = size.width < 720;
    const overviewZoom = isMobile ? 38 : 60;
    const detailZoom = isMobile ? 70 : 80;
    if (!isZoomed) {
      targetRef.current = {
        position: isMobile ? [0, 10, 7] : [12, 12, 12],
        lookAt: isMobile ? [0, 0, -4.5] : [0, 0, -6],
        zoom: overviewZoom
      };
      return;
    }
    const stall = STALLS.find((entry) => entry.key === activeCategory) || STALLS[0];
    const [x, , z] = isMobile && stall.mobilePosition ? stall.mobilePosition : stall.position;
    targetRef.current = {
      position: isMobile ? [x + 6, 7, z + 6] : [x + 7, 7, z + 7],
      lookAt: [x, 0.5, z],
      zoom: detailZoom
    };
  }, [activeCategory, isZoomed, size.width]);

  useFrame((state, delta) => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const { position, lookAt, zoom } = targetRef.current;
    cam.position.lerp({ x: position[0], y: position[1], z: position[2] }, 1 - Math.pow(0.001, delta));
    cam.zoom += (zoom - cam.zoom) * (1 - Math.pow(0.001, delta));
    cam.updateProjectionMatrix();
    cam.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  });

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[12, 12, 12]}
      zoom={60}
      near={0.1}
      far={200}
    />
  );
};

const Stall = ({ stall, isActive, onSelect, art, positionOverride }) => {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  return (
    <group
      position={positionOverride || stall.position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onPointerDown={() => onSelect(stall.key)}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.8, 32]} />
        <meshStandardMaterial color={stall.accent} opacity={0.6} transparent />
      </mesh>
      {art ? (
        <group>
          {art.backplate && (
            <sprite position={[0, 1.2, 0]} scale={[5.2, 3.6, 1]} renderOrder={2}>
              <spriteMaterial map={art.backplate} transparent alphaTest={0.1} depthWrite={false} />
            </sprite>
          )}
          {art.sign && (
            <sprite position={[0, 3.35, 0.1]} scale={[4.2, 1.6, 1]} renderOrder={3}>
              <spriteMaterial map={art.sign} transparent alphaTest={0.1} depthWrite={false} />
            </sprite>
          )}
          {art.mascot && (
            <sprite position={[0, 0.9, 1.1]} scale={[1.8, 2.4, 1]} renderOrder={4}>
              <spriteMaterial map={art.mascot} transparent alphaTest={0.1} depthWrite={false} />
            </sprite>
          )}
          {art.prop && (
            <sprite position={[1.1, 0.95, -0.4]} scale={[1.0, 1.0, 1]} renderOrder={2}>
              <spriteMaterial map={art.prop} transparent alphaTest={0.1} depthWrite={false} />
            </sprite>
          )}
        </group>
      ) : (
        <group>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[3, 2, 2]} />
            <meshStandardMaterial color={stall.color} />
          </mesh>
          <mesh position={[0, 2.3, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[2.2, 0.3, 0.6]} />
            <meshStandardMaterial color={stall.accent} />
          </mesh>
          <mesh position={[1.1, 0.8, 0.8]}>
            <cylinderGeometry args={[0.35, 0.5, 1.2, 16]} />
            <meshStandardMaterial color={isActive ? '#f8e6a0' : '#d4c4a2'} />
          </mesh>
          <mesh position={[1.1, 1.6, 0.8]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshStandardMaterial color={isActive ? '#ffe5ba' : '#f2d4b2'} />
          </mesh>
        </group>
      )}
    </group>
  );
};

const MarketSceneContent = ({ activeCategory, isZoomed, onSelectCategory }) => {
  const { size } = useThree();
  const isMobile = size.width < 720;
  const groundTexture = useTexture(marketGroundTile);
  const fogTexture = useTexture(marketFog);
  const shadowTexture = useTexture(marketShadowBlob);
  const illusionBackplate = useTexture(stallIllusionBackplate);
  const blessingBackplate = useTexture(stallBlessingBackplate);
  const illusionMascot = useTexture(mascotIllusionJester);
  const blessingMascot = useTexture(mascotBlessingOracle);
  const illusionProp = useTexture(propIllusionMirror);
  const blessingProp = useTexture(propBlessingCandles);
  const illusionSign = useTexture(signIllusion);
  const blessingSign = useTexture(signBlessing);
  const curseBackplate = useTexture(stallCurseBackplate);
  const curseMascot = useTexture(mascotCurseOathbinder);
  const curseProp = useTexture(propCurseTome);
  const curseSign = useTexture(signCurse);

  useMemo(() => {
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10);
    groundTexture.anisotropy = 4;
    groundTexture.center.set(0.5, 0.5);
    groundTexture.rotation = Math.PI / 4;
    const textures = [
      groundTexture,
      fogTexture,
      shadowTexture,
      illusionBackplate,
      blessingBackplate,
      illusionMascot,
      blessingMascot,
      illusionProp,
      blessingProp,
      illusionSign,
      blessingSign,
      curseBackplate,
      curseMascot,
      curseProp,
      curseSign,
    ];
    textures.forEach((texture) => {
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
      }
    });
  }, [
    groundTexture,
    fogTexture,
    shadowTexture,
    illusionBackplate,
    blessingBackplate,
    illusionMascot,
    blessingMascot,
    illusionProp,
    blessingProp,
    illusionSign,
    blessingSign,
    curseBackplate,
    curseMascot,
    curseProp,
    curseSign,
  ]);

  const stallArt = useMemo(() => ({
    illusion: {
      backplate: illusionBackplate,
      mascot: illusionMascot,
      prop: illusionProp,
      sign: illusionSign,
    },
    blessing: {
      backplate: blessingBackplate,
      mascot: blessingMascot,
      prop: blessingProp,
      sign: blessingSign,
    },
    curse: {
      backplate: curseBackplate,
      mascot: curseMascot,
      prop: curseProp,
      sign: curseSign,
    },
  }), [
    illusionBackplate,
    blessingBackplate,
    illusionMascot,
    blessingMascot,
    illusionProp,
    blessingProp,
    illusionSign,
    blessingSign,
    curseBackplate,
    curseMascot,
    curseProp,
    curseSign,
  ]);

  return (
    <>
      <CameraRig activeCategory={activeCategory} isZoomed={isZoomed} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 12, 6]} intensity={0.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial map={groundTexture} color="#ffffff" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={3}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial map={fogTexture} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {STALLS.filter((stall) => !isZoomed || stall.key === activeCategory).map((stall) => {
        const position = isMobile && stall.mobilePosition ? stall.mobilePosition : stall.position;
        return (
        <group key={stall.key}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[position[0], 0.01, position[2]]}
            renderOrder={1}
          >
            <planeGeometry args={[4.5, 4.5]} />
            <meshBasicMaterial map={shadowTexture} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <Stall
            stall={stall}
            isActive={activeCategory === stall.key}
            onSelect={onSelectCategory}
            art={stallArt[stall.key]}
            positionOverride={position}
          />
        </group>
      )})}
    </>
  );
};

const MarketScene = ({ activeCategory, isZoomed, onSelectCategory }) => {
  return (
    <Canvas
      className="market-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <MarketSceneContent
        activeCategory={activeCategory}
        isZoomed={isZoomed}
        onSelectCategory={onSelectCategory}
      />
    </Canvas>
  );
};

const MarketScene2D = ({ activeCategory, isZoomed, onSelectCategory }) => {
  const [isMobileMap, setIsMobileMap] = useState(() => window.innerWidth <= 720);

  useEffect(() => {
    const onResize = () => setIsMobileMap(window.innerWidth <= 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const hubMap = isMobileMap ? MARKET_HUB_MAPS.mobile : MARKET_HUB_MAPS.desktop;

  return (
    <div className={`market-map-scene ${isZoomed ? 'is-zoomed' : ''}`}>
      <div className="market-map-frame" style={{ aspectRatio: `${hubMap.width} / ${hubMap.height}` }}>
        <img
          className="market-map-image"
          src={hubMap.src}
          alt="Market hub map with three shop locations"
          draggable="false"
        />
        <div className="market-map-overlay" aria-hidden="true" />
        <div className="market-map-hitboxes">
          {STALLS.map((stall) => {
            const area = hubMap.areas[stall.key];
            const left = (area.x / hubMap.width) * 100;
            const top = (area.y / hubMap.height) * 100;
            const width = (area.width / hubMap.width) * 100;
            const height = (area.height / hubMap.height) * 100;
            const isActive = stall.key === activeCategory;
            return (
              <button
                key={stall.key}
                className={`market-map-hotspot market-map-hotspot--${stall.key}${isActive ? ' is-active' : ''}`}
                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                onClick={() => onSelectCategory(stall.key)}
                type="button"
                aria-pressed={isActive}
                aria-label={`Open ${stall.label} shop`}
              >
                <span className="market-map-enter-badge" aria-hidden="true">
                  <span className="market-map-enter-ring" />
                  <span className="market-map-enter-icon">
                    <FontAwesomeIcon icon={faDoorOpen} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="market-map-caption">
          Select a shop on the map to enter its stall.
        </div>
      </div>
    </div>
  );
};

const MarketSubshopScene = ({ activeCategory, activeLabel }) => {
  const art = STALL_STAGE_ART[activeCategory];

  if (!art) return null;

  return (
    <div className="market-subshop-scene">
      <picture className="market-subshop-scene-picture">
        <source media="(max-width: 720px)" srcSet={art.mobile} />
        <img
          className="market-subshop-scene-image"
          src={art.desktop}
          alt={`${activeLabel} stall interior`}
        />
      </picture>
      <div className="market-subshop-scene-overlay" aria-hidden="true" />
    </div>
  );
};

export default function Market() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { token, user, isAuthenticated, loading } = useAuth();

  const [campaignName, setCampaignName] = useState('Campaign Market');
  const [coins, setCoins] = useState(0);
  const [itemsByCategory, setItemsByCategory] = useState({ illusion: [], blessing: [], curse: [] });
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState('');
  const [purchaseBusy, setPurchaseBusy] = useState('');
  const [reshuffleBusy, setReshuffleBusy] = useState(false);
  const [canReshuffleByCategory, setCanReshuffleByCategory] = useState({ illusion: true, blessing: true, curse: true });
  const [restocksRemainingByCategory, setRestocksRemainingByCategory] = useState({ illusion: 2, blessing: 2, curse: 2 });
  const [purchasedItemKeys, setPurchasedItemKeys] = useState([]);
  const [canReshuffle, setCanReshuffle] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAdminCampaign, setIsAdminCampaign] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORY_META[0].key);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [webglReady, setWebglReady] = useState(true);
  const sceneMode = 'map';

  const spriteByKey = {
    oracle_whisper: oracleWhisperSprite,
    cartographers_insight: cartographersInsightSprite,
    candle_of_mercy: candleOfMercySprite,
    blood_oath_ink: bloodOathInkSprite,
    spider_swarm: spiderSwarmSprite,
    dance_of_the_jester: danceOfTheJesterSprite,
    cone_of_cold: coneOfColdSprite,
    seal_of_silence: sealOfSilenceSprite,
    voidbrand: voidbrandSprite,
    edict_of_compulsion: edictOfCompulsionSprite,
    executioners_cut: executionersCutSprite,
    send_in_the_clown: sendInTheClownSprite,
  };

  useEffect(() => {
    if (!loading && (!isAuthenticated || !user?.user_id)) {
      navigate('/login');
    }
  }, [isAuthenticated, user, loading, navigate]);

  useEffect(() => {
    if (isZoomed) {
      setShowItems(true);
    } else {
      setShowItems(false);
    }
  }, [isZoomed]);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      setWebglReady(Boolean(gl));
    } catch {
      setWebglReady(false);
    }
  }, []);

  const loadMarketState = useCallback(async () => {
    if (!campaignId || !token) return;
    setLoadingPage(true);
    setError('');

    try {
      const [stateRes, progressRes] = await Promise.all([
        fetch(`${API_BASE}/api/campaign/shop/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        }),
        fetch(`${API_BASE}/api/campaign/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ campaign_id: Number(campaignId) })
        })
      ]);

      if (progressRes.ok) {
        const progress = await progressRes.json();
        if (progress?.name) setCampaignName(progress.name);
        setIsAdminCampaign(Boolean(progress?.is_admin_campaign));
      }

      if (!stateRes.ok) {
        const err = await stateRes.json();
        throw new Error(err?.detail || 'Failed to load market');
      }

      const state = await stateRes.json();
      const rotationItems = Array.isArray(state?.items) ? state.items : [];
      const rotationByCategory = state?.items_by_category && typeof state.items_by_category === 'object'
        ? state.items_by_category
        : null;
      const grouped = { illusion: [], blessing: [], curse: [] };
      if (rotationByCategory) {
        Object.entries(rotationByCategory).forEach(([key, value]) => {
          if (grouped[key] && Array.isArray(value)) {
            grouped[key] = value;
          }
        });
      } else {
        rotationItems.forEach((item) => {
          const key = String(item.category || '').toLowerCase();
          if (grouped[key]) {
            grouped[key].push(item);
          }
        });
      }
      const reshuffleByCategory = state?.can_reshuffle_by_category && typeof state.can_reshuffle_by_category === 'object'
        ? state.can_reshuffle_by_category
        : null;
      const restocksRemaining = state?.restocks_remaining_by_category && typeof state.restocks_remaining_by_category === 'object'
        ? state.restocks_remaining_by_category
        : null;
      setCoins(Number(state?.coins ?? 0));
      setItemsByCategory(grouped);
      setPurchasedItemKeys(Array.isArray(state?.purchased_item_keys) ? state.purchased_item_keys : []);
      setCanReshuffle(Boolean(state?.can_reshuffle));
      if (reshuffleByCategory) {
        setCanReshuffleByCategory({
          illusion: Boolean(reshuffleByCategory.illusion ?? true),
          blessing: Boolean(reshuffleByCategory.blessing ?? true),
          curse: Boolean(reshuffleByCategory.curse ?? true),
        });
      } else {
        setCanReshuffleByCategory({
          illusion: Boolean(state?.can_reshuffle),
          blessing: Boolean(state?.can_reshuffle),
          curse: Boolean(state?.can_reshuffle),
        });
      }
      if (restocksRemaining) {
        setRestocksRemainingByCategory({
          illusion: Number(restocksRemaining.illusion ?? 2),
          blessing: Number(restocksRemaining.blessing ?? 2),
          curse: Number(restocksRemaining.curse ?? 2),
        });
      } else {
        setRestocksRemainingByCategory({ illusion: 2, blessing: 2, curse: 2 });
      }
    } catch (err) {
      setError(err?.message || 'Failed to load market.');
    } finally {
      setLoadingPage(false);
    }
  }, [campaignId, token]);

  useEffect(() => {
    if (!loading && token && campaignId) {
      loadMarketState();
    }
  }, [loading, token, campaignId, loadMarketState]);

  const activeItems = itemsByCategory[activeCategory] || [];
  const activeMeta = CATEGORY_META.find((entry) => entry.key === activeCategory) || CATEGORY_META[0];
  const handleSelectCategory = useCallback((categoryKey, shouldZoom = true) => {
    setActiveCategory(categoryKey);
    if (shouldZoom) {
      setIsZoomed(true);
      setShowItems(true);
    }
  }, []);

  const handlePurchase = async (itemKey) => {
    if (purchaseBusy) return;
    setPurchaseBusy(itemKey);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId), item_key: itemKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Purchase failed');
      }
      setCoins(Number(data?.coins ?? coins));
      await loadMarketState();
    } catch (err) {
      setError(err?.message || 'Purchase failed.');
    } finally {
      setPurchaseBusy('');
    }
  };

  const handleReshuffle = async (categoryKey) => {
    if (reshuffleBusy || !canReshuffle || !canReshuffleByCategory[categoryKey]) return;
    setReshuffleBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/campaign/shop/reshuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: Number(campaignId), category: categoryKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Restock failed');
      }
      setCoins(Number(data?.coins ?? coins));
      if (data?.items_by_category) {
        setItemsByCategory(data.items_by_category);
      }
      await loadMarketState();
    } catch (err) {
      setError(err?.message || 'Restock failed.');
    } finally {
      setReshuffleBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div
      className={`market-wrapper market-theme-${activeCategory}${isAdminCampaign ? " admin-theme" : ""}`}
    >
      <header className="market-header">
        <div className="market-header-grid">
          <div className="market-title-card market-card">
            <h1 className="market-title">{campaignName} Market</h1>
            <div className="market-title-actions">
              <div className="market-coins">
                <span className="market-coins-value">
                  {coins}
                  <span className="market-coins-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={faCoins} />
                  </span>
                </span>
              </div>
              <button
                className="btn market-back-btn"
                onClick={() => navigate(`/campaign/${campaignId}`)}
                aria-label="Back to camp"
                title="Back to camp"
              >
                <FontAwesomeIcon icon={faCampground} />
              </button>
              {isZoomed && (
                <button
                  className="btn market-overview-btn market-title-overview"
                  onClick={() => {
                    setIsZoomed(false);
                    setShowItems(false);
                  }}
                  type="button"
                >
                  Overview
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="market-scene">
        {isZoomed ? (
          <MarketSubshopScene activeCategory={activeCategory} activeLabel={activeMeta.label} />
        ) : sceneMode === '3d' ? (
          webglReady ? (
            <MarketScene
              activeCategory={activeCategory}
              isZoomed={isZoomed}
              onSelectCategory={handleSelectCategory}
            />
          ) : (
            <div className="market-scene-fallback">
              3D market view unavailable on this device.
            </div>
          )
        ) : (
          <MarketScene2D
            activeCategory={activeCategory}
            isZoomed={isZoomed}
            onSelectCategory={handleSelectCategory}
          />
        )}
      </section>

      {showItems && (
        <section className={`market-surface${isZoomed ? ' is-subshop' : ''}`}>
        {error && <div className="market-panel market-error">{error}</div>}
        {loadingPage ? (
          <div className="market-panel">Loading market...</div>
        ) : (
          <div className="market-grid">
            <div className="market-panel market-panel--full">
              <div className="market-panel-header">
                <h2>{activeMeta.label}</h2>
                <div className="market-panel-actions">
                  <span className="market-pill">{Math.max(0, Number(restocksRemainingByCategory[activeCategory] ?? 0))}</span>
                  <button
                    className={`btn market-restock-btn ${(!canReshuffleByCategory[activeCategory] || Number(restocksRemainingByCategory[activeCategory] ?? 0) <= 0 || coins < 3) ? 'disabled' : ''}`}
                    onClick={() => handleReshuffle(activeCategory)}
                    disabled={reshuffleBusy || !canReshuffleByCategory[activeCategory] || Number(restocksRemainingByCategory[activeCategory] ?? 0) <= 0 || coins < 3}
                    type="button"
                  >
                    {reshuffleBusy ? 'Restocking...' : (
                      <>
                        Restock <span className="market-restock-cost-inline">(3 <FontAwesomeIcon icon={faCoins} />)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="market-items">
                {activeItems.length === 0 ? (
                  <div className="market-empty">No items in this stall yet.</div>
                ) : (
                  activeItems.map((item) => {
                    const purchased = purchasedItemKeys.includes(item.key);
                    return (
                      <div className={`market-item-card${purchased ? " purchased" : ""}`} key={item.key}>
                        <div className="market-item-body">
                          <div className="market-item-title">{item.name}</div>
                          <div className={`market-item-sprite${spriteByKey[item.key] ? " has-image" : ""}`}>
                            {spriteByKey[item.key] ? (
                              <img
                                src={spriteByKey[item.key]}
                                alt={item.name}
                                className="market-item-sprite-img"
                              />
                            ) : (
                              <span>Sprite</span>
                            )}
                          </div>
                          <div className="market-item-footer">
                            <span className="market-item-cost">
                              {item.cost}
                              <span className="market-item-cost-icon" aria-hidden="true">
                                <FontAwesomeIcon icon={faCoins} />
                              </span>
                            </span>
                          </div>
                        </div>
                        <button
                          className="btn"
                          onClick={() => setSelectedItem(item)}
                        >
                          View
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      )}
      {selectedItem && (
        <div className="market-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="market-modal" onClick={(event) => event.stopPropagation()}>
            <div className="market-modal-header">
              <h3>{selectedItem.name}</h3>
              <button className="market-modal-close" onClick={() => setSelectedItem(null)} type="button">
                ×
              </button>
            </div>
            <div className="market-modal-tag-row">
              {selectedItem.affects_others ? (
                <span className="market-modal-tag market-modal-tag--enemy">Target Enemy</span>
              ) : (
                <span className="market-modal-tag market-modal-tag--self">Target Self</span>
              )}
            </div>
            <div className="market-modal-body">
              <div className="market-modal-image">
                {spriteByKey[selectedItem.key] && (
                  <img
                    src={spriteByKey[selectedItem.key]}
                    alt={selectedItem.name}
                    className="market-modal-image-img"
                  />
                )}
              </div>
              <div className="market-modal-text">
                <p className="market-modal-description">{selectedItem.description}</p>
              </div>
            </div>
            <div className="market-modal-actions">
              <div className="market-modal-cost">
                {selectedItem.cost}
                <span className="market-item-cost-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faCoins} />
                </span>
              </div>
              <button
                className={`btn ${coins < selectedItem.cost || purchasedItemKeys.includes(selectedItem.key) ? 'disabled' : ''}`}
                disabled={coins < selectedItem.cost || purchasedItemKeys.includes(selectedItem.key) || purchaseBusy === selectedItem.key}
                onClick={() => handlePurchase(selectedItem.key)}
                type="button"
              >
                {purchasedItemKeys.includes(selectedItem.key) ? 'Purchased' : purchaseBusy === selectedItem.key ? 'Purchasing...' : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
