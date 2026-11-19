import React from 'react';

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function Logo({ className = 'h-10 w-auto sm:h-12', ...props }: LogoProps) {
    const rPath =
        'M43.669274280900225 727.6293176074137Q28.60204597424478 741.580454928391 21.510217836081342 732.2796967144061Q14.418389697917902 722.9789385004212 13.596822722349245 698.9519797809604Q12.775255746780587 674.9250210614996 17.999181610302074 646.2476832350463Q23.22310747382356 617.5703454085931 33.1981706583223 591.9932603201348Q43.173233842821034 566.4161752316766 57.217378745938134 552.4650379106993L323.3120712480443 301.3445661331087L296.3398724274882 436.2055602358888L130.69336863641834 185.08508845829817Q122.22967866169213 171.133951137321 122.48544951257672 145.55686604886267Q122.74122036346131 119.97978096040436 129.14324226742087 90.52737994945238Q135.54526417138044 61.07497893850041 145.9776146347334 37.048020219039586Q156.40996509808642 13.021061499578764 167.2220965218438 3.7203032855939Q178.03422794560117 -5.580454928390964 187.5210013238657 8.370682392586332L331.3262245757612 233.13900589721982Q355.60120351426167 270.34203875315916 336.37963653869303 366.4498736310025Q326.45882777710915 416.05391743892164 312.1201588638825 449.38163437236733Q297.7814899506559 482.70935130581296 277.3818269346492 502.8609941027801Z';

    const aazPaths = (
        <>
            <path d="M362 30Q339 0 301 0H212Q136 0 101.5 30.5Q67 61 67 135V155Q67 310 213 310H337V360Q337 391 318.0 408.0Q299 425 262 425H107V500H252Q339 500 380.5 462.0Q422 424 422 340V100Q422 85 433.5 77.5Q445 70 472 70V0H417Q404 0 388.5 8.0Q373 16 362 30ZM337 125V235H212Q186 235 169.0 218.0Q152 201 152 175V125Q152 99 164.0 87.0Q176 75 202 75H291Q321 75 329.0 89.0Q337 103 337 125Z" />
            <path d="M837.2 30Q814.2 0 776.2 0H687.2Q611.2 0 576.7 30.5Q542.2 61 542.2 135V155Q542.2 310 688.2 310H812.2V360Q812.2 391 793.2 408.0Q774.2 425 737.2 425H582.2V500H727.2Q814.2 500 855.7 462.0Q897.2 424 897.2 340V100Q897.2 85 908.7 77.5Q920.2 70 947.2 70V0H892.2Q879.2 0 863.7 8.0Q848.2 16 837.2 30ZM812.2 125V235H687.2Q661.2 235 644.2 218.0Q627.2 201 627.2 175V125Q627.2 99 639.2 87.0Q651.2 75 677.2 75H766.2Q796.2 75 804.2 89.0Q812.2 103 812.2 125Z" />
            <path d="M1374.4 0H1056.4V80L1290.4 426H1076.4V500H1384.4V411L1152.4 74H1374.4Z" />
        </>
    );

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="517.9 -72.0 1589.1 809.9"
            className={className}
            aria-label="Raaz"
            role="img"
            {...props}
        >
            <defs>
                <filter id="logo-grain" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.85"
                        numOctaves={2}
                        seed={11}
                        stitchTiles="stitch"
                        result="noise"
                    />
                    <feColorMatrix
                        in="noise"
                        type="matrix"
                        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0"
                        result="noiseAlpha"
                    />
                    <feComposite
                        in="noiseAlpha"
                        in2="SourceGraphic"
                        operator="in"
                        result="clippedNoiseDark"
                    />
                    <feColorMatrix
                        in="noise"
                        type="matrix"
                        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.128 0"
                        result="noiseAlphaLight"
                    />
                    <feComposite
                        in="noiseAlphaLight"
                        in2="SourceGraphic"
                        operator="in"
                        result="clippedNoiseLight"
                    />
                    <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode in="clippedNoiseLight" />
                        <feMergeNode in="clippedNoiseDark" />
                    </feMerge>
                </filter>
                <filter id="logo-softblur" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="11.9" />
                </filter>
            </defs>
            {/* Ambient drop shadow */}
            <g
                fill="#000000"
                opacity="0.30"
                filter="url(#logo-softblur)"
                transform="translate(45.9,45.9)"
            >
                <g transform="translate(518.39,-58.00)">
                    <path d={rPath} />
                </g>
                <g
                    transform="translate(925.60,510.00) scale(0.800000,-0.800000)"
                    strokeWidth="27.50"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                >
                    {aazPaths}
                </g>
            </g>
            {/* Deep shadow layer */}
            <g style={{ fill: 'var(--logo-dark, #2E3600)', stroke: 'var(--logo-dark, #2E3600)' }}>
                <g transform="translate(552.39,-24.00)">
                    <path d={rPath} />
                </g>
                <g
                    transform="translate(959.60,544.00) scale(0.800000,-0.800000)"
                    strokeWidth="27.50"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                >
                    {aazPaths}
                </g>
            </g>
            {/* Midtone accent layer */}
            <g style={{ fill: 'var(--logo-mid, #637300)', stroke: 'var(--logo-mid, #637300)' }}>
                <g transform="translate(535.39,-41.00)">
                    <path d={rPath} />
                </g>
                <g
                    transform="translate(942.60,527.00) scale(0.800000,-0.800000)"
                    strokeWidth="27.50"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                >
                    {aazPaths}
                </g>
            </g>
            {/* Top highlight face layer with grain */}
            <g
                style={{
                    fill: 'var(--logo-highlight, #B4D200)',
                    stroke: 'var(--logo-highlight, #B4D200)',
                }}
                filter="url(#logo-grain)"
            >
                <g transform="translate(518.39,-58.00)">
                    <path d={rPath} />
                </g>
                <g
                    transform="translate(925.60,510.00) scale(0.800000,-0.800000)"
                    strokeWidth="27.50"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                >
                    {aazPaths}
                </g>
            </g>
        </svg>
    );
}

export default Logo;
