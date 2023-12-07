import React from 'react';

const CircularToggleEnabled = ({ fill = '#3E63DD', width = '24', className = '', viewBox = '0 0 19 18' }) => (
  <svg
    className={className}
    width={width}
    height={width}
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    data-cy="circular-toggle-enabled-icon"
  >
    <circle cx="9.41406" cy="9" r="9" fill={fill} />
    <path
      d="M7.92626 10.5297L6.36746 8.9566L6.36749 8.95658L6.36437 8.95354C6.23104 8.82359 6.05199 8.75128 5.86568 8.75291C5.67937 8.75455 5.50161 8.82998 5.37056 8.96223C5.23959 9.09441 5.16569 9.27274 5.16409 9.4587C5.16249 9.64466 5.2333 9.82424 5.36196 9.95867L5.36193 9.9587L5.36499 9.96178L7.42502 12.0407L7.42505 12.0407C7.5576 12.1745 7.73784 12.25 7.92626 12.25C8.11468 12.25 8.29492 12.1745 8.42747 12.0407L8.42749 12.0407L13.4631 6.9589L13.4632 6.95892L13.4662 6.95578C13.5948 6.82135 13.6656 6.64177 13.664 6.45582C13.6624 6.26986 13.5885 6.09152 13.4576 5.95934C13.3265 5.82709 13.1488 5.75166 12.9624 5.75003C12.7761 5.74839 12.5971 5.8207 12.4638 5.95066L12.4637 5.95063L12.4607 5.95372L7.92626 10.5297Z"
      fill="white"
      stroke="white"
      stroke-width="0.5"
    />
  </svg>
);

export default CircularToggleEnabled;
